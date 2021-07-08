import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { addComment, getComments } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { CommentPanel } from './panel';
import { CommentWidget } from './widget';
import { Cell } from '@jupyterlab/cells';

namespace CommandIDs {
  export const addComment = 'jl-chat:add-comment';
  export const deleteComment = 'jl-chat:delete-comment';
  export const editComment = 'jl-chat:edit-comment';
  export const replyToComment = 'jl-chat:reply-to-comment';
}

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  requires: [INotebookTracker, ILabShell],
  activate: (
    app: JupyterFrontEnd,
    nbTracker: INotebookTracker,
    shell: ILabShell
  ) => {
    // A widget tracker for comment widgets
    const commentTracker = new WidgetTracker<CommentWidget<any>>({
      namespace: 'comment-widgets'
    });

    // The side panel that will host the comments
    const panel = new CommentPanel({
      tracker: nbTracker,
      commands: app.commands
    });
    shell.add(panel, 'right', { rank: 500 });

    // Automatically add the comment widgets to the tracker as
    // they're added to the panel
    panel.commentAdded.connect(
      (_, comment) => void commentTracker.add(comment)
    );

    shell.currentChanged.connect(() => panel.update());

    const onActiveCellChanged = (_: any, cell: Cell | null): void => {
      if (cell == null) {
        return;
      }

      const comments = getComments(cell!.model.metadata);
      if (comments == null) {
        return;
      }

      panel.scrollToComment(comments[0].id);
    };

    // Scroll to a cell's comments when that cell is focused.
    nbTracker.activeCellChanged.connect(onActiveCellChanged);

    addCommands(app, nbTracker, commentTracker, panel);

    // Add entries to the drop-down menu for comments
    panel.commentMenu.addItem({ command: CommandIDs.deleteComment });
    panel.commentMenu.addItem({ command: CommandIDs.editComment });
    panel.commentMenu.addItem({ command: CommandIDs.replyToComment });

    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });

    app.contextMenu.addItem({
      command: 'jl-chat:listen',
      selector: '.jp-Notebook .jp-Cell',
      rank: 14
    });
  }
};

function addCommands(
  app: JupyterFrontEnd,
  nbTracker: INotebookTracker,
  commentTracker: WidgetTracker<CommentWidget<any>>,
  panel: CommentPanel
): void {
  const getAwareness = (): Awareness | undefined => {
    return (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness;
  };

  app.commands.addCommand('jl-chat:listen', {
    label: 'Listen For Awareness Changes',
    execute: () => {
      const awareness = getAwareness();
      awareness?.on('change', () => console.log(awareness.getLocalState()));
    }
  });

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
          const comment: IComment = {
            id: UUID.uuid4(),
            type: 'cell',
            identity: getIdentity(getAwareness()!),
            replies: [],
            text: value.value,
            time: getCommentTimeString()
          };

          addComment(cell.model.metadata, comment);

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

export default plugin;
