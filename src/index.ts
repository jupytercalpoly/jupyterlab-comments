import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { addComment, getComments } from './comments';
import { Token, UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { CommentPanel, ICommentPanel } from './panel';
import { CommentWidget } from './widget';
import { Cell } from '@jupyterlab/cells';
import { CommentRegistry, ICommentRegistry } from './registry';
import * as Y from 'yjs';

namespace CommandIDs {
  export const addComment = 'jl-comments:add-comment';
  export const deleteComment = 'jl-comments:delete-comment';
  export const editComment = 'jl-comments:edit-comment';
  export const replyToComment = 'jl-comments:reply-to-comment';
}

const ICommentRegistry = new Token<ICommentRegistry>(
  'jupyterlab-comments:comment-registry'
);

/**
 * A plugin that provides a `CommentRegistry`
 */
export const commentRegistryPlugin: JupyterFrontEndPlugin<ICommentRegistry> = {
  id: 'jupyterlab-comments:registry',
  autoStart: true,
  provides: ICommentRegistry,
  activate: (app: JupyterFrontEnd) => {
    return new CommentRegistry();
  }
};

const ICommentPanel = new Token<ICommentPanel>(
  'jupyterlab-comments:comment-panel'
);

/**
 * A plugin that provides a `CommentPanel`
 */
export const panelPlugin: JupyterFrontEndPlugin<ICommentPanel> = {
  id: 'jupyterlab-comments:panel',
  autoStart: true,
  requires: [INotebookTracker, ICommentRegistry, ILabShell],
  provides: ICommentPanel,
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    registry: ICommentRegistry,
    shell: ILabShell
  ) => {
    // Create the singleton `CommentPanel`
    const panel = new CommentPanel({
      tracker: tracker,
      commands: app.commands,
      registry: registry,
      shell: shell

    });

    // Add the panel to the shell's right area.
    shell.add(panel, 'right', { rank: 500 });

    // Attach listeners to update the panel when it's revealed or the current document changes.
    panel.revealed.connect(() => panel.update());
    shell.currentChanged.connect(() => panel.update());

    return panel;
  }
};

/**
 * A plugin that allows notebooks to be commented on.
 */
const notebookCommentsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-comments:plugin',
  autoStart: true,
  requires: [INotebookTracker, ILabShell, ICommentPanel, ICommentRegistry],
  activate: (
    app: JupyterFrontEnd,
    nbTracker: INotebookTracker,
    shell: ILabShell,
    panel: ICommentPanel,
    registry: ICommentRegistry
  ) => {
    // A widget tracker for comment widgets
    const commentTracker = new WidgetTracker<CommentWidget<any>>({
      namespace: 'comment-widgets'
    });

    void registry.createFactory<Cell>({
      type: 'cell',
      targetFactory: (cell: Cell) => {
        return { cellID: cell.model.id };
      }
    });

    void registry.createFactory<Cell>({
      type: 'cell-selection',
      targetFactory: (cell: Cell) => {
        const { start, end } = cell.editor.getSelection();
        return {
          cellID: cell.model.id,
          start,
          end
        };
      }
    });

    let currAwareness: Awareness | null = null;

    const indicator = Private.createIndicator(panel);

    // This updates the indicator and scrolls to the comments of the selected cell
    // when the active cell changes.
    nbTracker.activeCellChanged.connect((_, cell: Cell | null) => {
      if (cell == null) {
        if (indicator.parentElement != null) {
          indicator.remove();
        }
        return;
      }

      const comments = getComments(cell.model.sharedModel);
      if (comments != null && comments.length !== 0) {
        panel.scrollToComment(comments[0].id);
      }

      const awarenessHandler = (): void => {
        const { start, end } = cell.editor.getSelection();

        if (start.column !== end.column || start.line !== end.line) {
          if (!cell.node.contains(indicator)) {
            cell.node.childNodes[1].appendChild(indicator);
          }
        } else if (indicator.parentElement != null) {
          indicator.remove();
        }
      };

      if (currAwareness != null) {
        currAwareness.off('change', awarenessHandler);
      }

      currAwareness = (nbTracker.currentWidget!.model!.sharedModel as YNotebook)
        .awareness;
      currAwareness.on('change', awarenessHandler);
    });

    // Automatically add the comment widgets to the tracker as
    // they're added to the panel
    panel.commentAdded.connect(
      (_, comment) => void commentTracker.add(comment)
    );

    // Looks for changes to metadata on cells and updates the panel as they occur.
    // This is what allows comments to be real-time.
    //
    // `events` and `t` are currently `any` because of a bug when importing `yjs`
    // Build fails for some people so for now the yjs types aren't being used directly.
    const handleCellChanges = (events: Y.YEvent[], t: unknown): void => {
      for (let e of events) {
        if (
          e.target instanceof Y.Map &&
          (e as Y.YMapEvent<any>).keysChanged.has('metadata')
        ) {
          panel.update();
          return;
        }
      }
    };

    let currPanel: NotebookPanel | null = null;
    // Attaches an observer to the current notebook's collaborative cells model
    const onNotebookChanged = (_: any, panel: NotebookPanel | null): void => {
      if (panel == null) {
        return;
      }

      let model: YNotebook;

      if (currPanel != null) {
        model = currPanel.model!.sharedModel as YNotebook;
        model.ycells.unobserveDeep(handleCellChanges);
      }

      model = panel.model!.sharedModel as YNotebook;
      model.ycells.observeDeep(handleCellChanges);
      currPanel = panel;
    };

    nbTracker.currentChanged.connect(onNotebookChanged);

    addCommands(app, nbTracker, commentTracker, panel, registry);

    // Add entries to the drop-down menu for comments
    panel.commentMenu.addItem({ command: CommandIDs.deleteComment });
    panel.commentMenu.addItem({ command: CommandIDs.editComment });
    panel.commentMenu.addItem({ command: CommandIDs.replyToComment });

    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });
  }
};

function addCommands(
  app: JupyterFrontEnd,
  nbTracker: INotebookTracker,
  commentTracker: WidgetTracker<CommentWidget<any>>,
  panel: ICommentPanel,
  registry: ICommentRegistry
): void {
  const getAwareness = (): Awareness | undefined => {
    return (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness;
  };

  const cellCommentFactory = registry.getFactory('cell')!;

  app.commands.addCommand(CommandIDs.addComment, {
    label: 'Add Comment',
    execute: async () => {
      const cell = nbTracker.currentWidget?.content.activeCell;
      if (cell == null) {
        return;
      }

      void InputDialog.getText({
        title: 'Enter Comment'
      }).then(value => {
        if (value.value != null) {
          const comment = cellCommentFactory.createComment({
            target: cell,
            identity: getIdentity(getAwareness()!),
            text: value.value
          });

          addComment(cell.model.sharedModel, comment);

          panel.update();
        }
      });
    }
  });

  app.commands.addCommand(CommandIDs.deleteComment, {
    label: 'Delete Comment',
    execute: () => {
      const currentComment = commentTracker.currentWidget;
      if (currentComment != null) {
        currentComment.deleteActive();
        panel.update();
      }
    }
  });

  app.commands.addCommand(CommandIDs.editComment, {
    label: 'Edit Comment',
    execute: () => {
      const currentComment = commentTracker.currentWidget;
      if (currentComment != null) {
        currentComment.editActive();
      }
    }
  });

  app.commands.addCommand(CommandIDs.replyToComment, {
    label: 'Reply to Comment',
    execute: () => {
      const currentComment = commentTracker.currentWidget;
      if (currentComment != null) {
        currentComment.revealReply();
      }
    }
  });
}

namespace Private {
  export function createIndicator(panel: ICommentPanel): HTMLElement {
    const nbTracker = panel.nbTracker;

    const indicator = document.createElement('div');
    indicator.className = 'jc-Indicator';

    indicator.onclick = () => {
      const cell = panel.nbTracker.activeCell;
      if (cell == null) {
        return;
      }

      const range = cell.editor.getSelection();

      void InputDialog.getText({ title: 'Add Comment' }).then(value => {
        if (value.value == null) {
          return;
        }

        const comment: IComment = {
          id: UUID.uuid4(),
          type: 'cell-selection',
          identity: getIdentity(panel.awareness!),
          replies: [],
          text: value.value,
          time: getCommentTimeString(),
          target: {
            cellID: cell.model.id,
            start: range.start,
            end: range.end
          }
        };

        if (nbTracker.activeCell != null) {
          addComment(cell.model.sharedModel, comment);
        }

        panel.update();
      });
    };

    return indicator;
  }
}

const plugins: JupyterFrontEndPlugin<any>[] = [
  panelPlugin,
  notebookCommentsPlugin,
  commentRegistryPlugin
];
export default plugins;
