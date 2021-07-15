import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { addComment, getComments } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment, ISelection } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { CommentPanel } from './panel';
import { CommentWidget } from './widget';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { Cell } from '@jupyterlab/cells';
// import * as Y from 'yjs';

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

    //WIP selection start

    let awarenessTracker = false;
    let onHover = false;
    //let selectionString = '';

    nbTracker.activeCellChanged.connect((_, cells) => {
      panel.update();
      if (awarenessTracker == false) {
        (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness.on(
          'change',
          () => {
            let range =
              nbTracker.activeCell?.editor.getSelection() as CodeEditor.IRange;
            if (
              range.end.column != range.start.column ||
              range.end.line != range.start.line
            ) {
              if (document.getElementsByClassName('jc-Indicator').length == 0) {
                let indicator = document.createElement('div');
                indicator.className = 'jc-Indicator';

                indicator.onclick = () => {
                  range =
                    nbTracker.activeCell?.editor.getSelection() as CodeEditor.IRange;
                  void InputDialog.getText({ title: 'Add Comment' }).then(
                    value => {
                      if (value.value != null) {
                        const comment: ISelection = {
                          id: UUID.uuid4(),
                          type: 'text',
                          identity: getIdentity(
                            (
                              nbTracker.currentWidget?.model
                                ?.sharedModel as YNotebook
                            ).awareness
                          ),
                          replies: [],
                          text: value.value,
                          time: getCommentTimeString(),
                          start: range.start,
                          end: range.end
                          //source: nbTracker.activeCell!.model,
                          //content: selectionString
                        };
                        if (nbTracker.activeCell != null) {
                          addComment(
                            nbTracker.activeCell.model.sharedModel,
                            comment
                          );
                        }

                        panel.update();
                      }
                    }
                  );
                };
                indicator.onmouseover = () => {
                  onHover = true;
                };
                indicator.onmouseout = () => {
                  onHover = false;
                };

                nbTracker.activeCell?.node.childNodes[1].appendChild(indicator);
              }
            } else {
              if (
                document.getElementsByClassName('jc-Indicator').length != 0 &&
                onHover == false
              ) {
                let elem = document.getElementsByClassName('jc-Indicator')[0];
                elem.parentNode?.removeChild(elem);
              }
            }
          }
        );
        awarenessTracker = true;
      }
    });
    shell.add(panel, 'right', { rank: 500 });

    // Automatically add the comment widgets to the tracker as
    // they're added to the panel
    panel.commentAdded.connect(
      (_, comment) => void commentTracker.add(comment)
    );

    panel.revealed.connect(() => panel.update());

    shell.currentChanged.connect(() => panel.update());

    const onActiveCellChanged = (_: any, cell: Cell | null): void => {
      if (cell == null) {
        return;
      }

      const comments = getComments(cell.model.sharedModel);
      if (comments == null || comments.length === 0) {
        return;
      }

      panel.scrollToComment(comments[0].id);
    };

    // Scroll to a cell's comments when that cell is focused.
    nbTracker.activeCellChanged.connect(onActiveCellChanged);

    // Looks for changes to metadata on cells and updates the panel as they occur.
    // This is what allows comments to be real-time.
    const handleCellChanges = (events: any, t: any): void => {
      for (let e of events) {
        if (
          // e.target instanceof Y.Map &&
          (e as any).keysChanged.has('metadata')
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

  app.commands.addCommand(CommandIDs.addComment, {
    label: 'Add Comment',
    execute: async () => {
      const cell = nbTracker.currentWidget?.content.activeCell;
      if (cell == null) {
        return;
      }

      console.log('SEL TRY: ', nbTracker?.activeCell?.editor.getSelection());
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

export default plugin;
