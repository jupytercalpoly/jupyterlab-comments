import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { PartialJSONValue, Token, UUID } from '@lumino/coreutils';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getIdentity, randomIdentity } from './utils';
import { CommentPanel2, ICommentPanel } from './panel';
import { CommentWidget, CommentWidget2 } from './widget';
import { Cell } from '@jupyterlab/cells';
import { CommentRegistry, ICommentRegistry } from './registry';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';
import {
  CellCommentFactory,
  CellSelectionCommentFactory,
  TestCommentFactory
} from './factory';
import { Menu } from '@lumino/widgets';
import { CommentFileModelFactory, ICommentOptions } from './model';
import { ICellComment } from './commentformat';

namespace CommandIDs {
  export const addComment = 'jl-comments:add-comment';
  export const deleteComment = 'jl-comments:delete-comment';
  export const editComment = 'jl-comments:edit-comment';
  export const replyToComment = 'jl-comments:reply-to-comment';
  export const addNotebookComment = 'jl-comments:add-notebook-comment';
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

type CommentTracker = WidgetTracker<CommentWidget<any> | CommentWidget2<any>>;

// const ICommentTracker = new Token<CommentTracker>(
//   'jupyterlab-comments:comment-tracker'
// );

/**
 * A plugin that allows notebooks to be commented on.
 */
const notebookCommentsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-comments:plugin',
  autoStart: true,
  requires: [INotebookTracker, ICommentPanel, ICommentRegistry],
  activate: (
    app: JupyterFrontEnd,
    nbTracker: INotebookTracker,
    panel: ICommentPanel,
    registry: ICommentRegistry
  ) => {
    void registry.addFactory(new CellCommentFactory(nbTracker));
    void registry.addFactory(new CellSelectionCommentFactory(nbTracker));

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

      const model = panel.model;
      if (model == null) {
        return;
      }

      for (let comment of model.comments) {
        if (comment.type === 'cell' || comment.type === 'cell-selection') {
          const cellComment = comment as ICellComment;
          if (cellComment.target.cellID === cell.model.id) {
            panel.scrollToComment(cellComment.id);
            break;
          }
        }
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

    // Add entries to the drop-down menu for comments
    panel.commentMenu.addItem({ command: CommandIDs.deleteComment });
    panel.commentMenu.addItem({ command: CommandIDs.editComment });
    panel.commentMenu.addItem({ command: CommandIDs.replyToComment });

    app.commands.addCommand(CommandIDs.addNotebookComment, {
      label: 'Add Cell Comment',
      execute: () => {
        const cell = nbTracker.activeCell;
        if (cell == null) {
          return;
        }

        void InputDialog.getText({
          title: 'Enter Comment'
        }).then(value => {
          if (value.value == null) {
            return;
          }

          const model = panel.model!;
          model.addComment({
            source: cell,
            text: value.value,
            identity: getIdentity(model.awareness),
            type: 'cell'
          });

          panel.update();
        });
      }
    });

    app.contextMenu.addItem({
      command: CommandIDs.addNotebookComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });
  }
};

export const jupyterCommentingPlugin: JupyterFrontEndPlugin<ICommentPanel> = {
  id: 'jupyterlab-comments:commenting-api',
  autoStart: true,
  requires: [ICommentRegistry, ILabShell, IDocumentManager, INotebookTracker],
  provides: ICommentPanel,
  activate: (
    app: JupyterFrontEnd,
    registry: ICommentRegistry,
    shell: ILabShell,
    docManager: IDocumentManager,
    tracker: INotebookTracker
  ): CommentPanel2 => {
    const filetype: DocumentRegistry.IFileType = {
      contentType: 'file',
      displayName: 'comment',
      extensions: ['.comment'],
      fileFormat: 'text',
      name: 'comment',
      mimeTypes: ['text/plain']
    };

    const commentTracker = new WidgetTracker<CommentWidget2<any>>({
      namespace: 'comment-widgets'
    });

    void registry.addFactory(new TestCommentFactory());

    const commentMenu = new Menu({ commands: app.commands });
    commentMenu.addItem({ command: CommandIDs.deleteComment });
    commentMenu.addItem({ command: CommandIDs.editComment });
    commentMenu.addItem({ command: CommandIDs.replyToComment });

    const modelFactory = new CommentFileModelFactory({
      registry,
      commentMenu
    });

    app.docRegistry.addFileType(filetype);
    app.docRegistry.addModelFactory(modelFactory);

    const panel = new CommentPanel2({
      commands: app.commands,
      registry,
      docManager,
      tracker,
      shell
    });

    addCommands(app, commentTracker, panel);

    // Add the panel to the shell's right area.
    shell.add(panel, 'right', { rank: 600 });

    panel.revealed.connect(() => panel.update());
    shell.currentChanged.connect((_, args) => {
      if (args.newValue != null && args.newValue instanceof DocumentWidget) {
        const docWidget = args.newValue as DocumentWidget;
        const path = docWidget.context.path;
        if (path !== '') {
          void panel.loadModel(docWidget.context.path);
        }
      }
    });

    panel.modelChanged.connect((_, fileWidget) => {
      if (fileWidget != null) {
        fileWidget.commentAdded.connect(
          (_, commentWidget) => void commentTracker.add(commentWidget)
        );
      }
    });

    app.commands.addCommand('addComment', {
      label: 'Add Document Comment',
      execute: () => {
        const model = panel.model!;
        model.addComment({
          text: UUID.uuid4(),
          type: 'test',
          target: null,
          identity: randomIdentity()
        });
        panel.update();
      },
      isEnabled: () => panel.model != null
    });

    app.commands.addCommand('saveCommentFile', {
      label: 'Save Comment File',
      execute: () => void panel.fileWidget!.context.save(),
      isEnabled: () => panel.model != null
    });

    app.contextMenu.addItem({
      command: 'addComment',
      selector: '.lm-Widget',
      rank: 0
    });

    app.contextMenu.addItem({
      command: 'saveCommentFile',
      selector: '.lm-Widget',
      rank: 1
    });

    return panel;
  }
};

function addCommands(
  app: JupyterFrontEnd,
  commentTracker: CommentTracker,
  panel: ICommentPanel
): void {
  app.commands.addCommand(CommandIDs.addComment, {
    label: 'Add Comment',
    execute: async args => {
      const model = panel.model;
      if (model == null) {
        return;
      }
      if (!('target' in args && args.target != null)) {
        return;
      }

      void InputDialog.getText({
        title: 'Enter Comment'
      }).then(value => {
        if (value.value != null) {
          const { target, type, source } = args;

          let comment: ICommentOptions;
          if (source != null) {
            comment = {
              type: type as string,
              text: value.value,
              identity: getIdentity(model.awareness),
              source
            };
          } else if (target != null) {
            comment = {
              type: type as string,
              text: value.value,
              identity: getIdentity(model.awareness),
              target: target as PartialJSONValue
            };
          } else {
            return;
          }

          model.addComment(comment);

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
        currentComment.openEditActive();
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
      const cell = nbTracker.activeCell;
      if (cell == null) {
        return;
      }

      void InputDialog.getText({ title: 'Add Comment' }).then(value => {
        if (value.value == null) {
          return;
        }

        const model = panel.model;
        if (model == null) {
          return;
        }

        model.addComment({
          type: 'cell-selection',
          text: value.value,
          source: cell,
          identity: getIdentity(model.awareness)
        });

        panel.update();
      });
    };

    return indicator;
  }
}

const plugins: JupyterFrontEndPlugin<any>[] = [
  notebookCommentsPlugin,
  commentRegistryPlugin,
  jupyterCommentingPlugin
];
export default plugins;
