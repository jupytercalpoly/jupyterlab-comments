import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { addComment, deleteComment, deleteReply } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { CommentPanel } from './panel';
import { CommentWidget } from './widget';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

namespace CommandIDs {
  export const addComment = 'jl-chat:add-comment';
  export const deleteComment = 'jl-chat:delete-comment';
}

// namespace HighlightConst {
//   export const lineBuf = 17;
//   export const charSize = 7.82666015625;
// }

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, nbTracker: INotebookTracker) => {
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
    let selectionString = "";

    nbTracker.activeCellChanged.connect((_, cells) => {
      panel.update();
      if(awarenessTracker == false)
      {
        (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness.on('change', () => {
          if(window.getSelection()!.toString().length > 0)
          {
            selectionString = window.getSelection()!.toString();
            if(document.getElementsByClassName('jc-Indicator').length == 0)
            {
              let indicator = document.createElement('div');
              indicator.className = 'jc-Indicator';
              indicator.onclick = () => {
                console.log(selectionString);
                console.log("sel: ", nbTracker.activeCell?.editor.getSelection());
                let range = nbTracker.activeCell?.editor.getSelection() as CodeEditor.IRange;
                void InputDialog.getText({title: 'Add Comment',
                }).then(value => {
                  if(value.value != null){

                    let mD = "> [";
                    let text = mD.concat(selectionString, "]\n ", value.value);
                    
                    const comment : IComment = {
                      id: UUID.uuid4(),
                      type: 'text',
                      identity: getIdentity((nbTracker.currentWidget?.model
                        ?.sharedModel as YNotebook).awareness),
                      replies: [],
                      text: text,
                      time: new Date(new Date().getTime()).toLocaleString()
                    };

                    if(nbTracker.activeCell != null)
                    {
                      addComment(nbTracker.activeCell.model.metadata, comment);
                    }
                  
                    (nbTracker.activeCell?.editor as CodeMirrorEditor).doc.markText(
                      {line: range.start.line, ch: range.start.column}, 
                      {line: range.end.line, ch: range.end.column},
                      {className: 'jc-Highlight'});
                    
                    panel.update();
                    nbTracker.activeCell?.editor.setSelection(range);
                  }
                });
                
              };
              indicator.onmouseover = () => {
                onHover = true;
              };
              indicator.onmouseout = () => {
                onHover = false;
              };
              nbTracker.activeCell?.node.childNodes[1].appendChild(indicator); //firstChild?.
              //childNodes[1].childNodes[1].childNodes[1].firstChild?
            }
          }
          else
          {
            if(document.getElementsByClassName('jc-Indicator').length != 0 && onHover == false)
            {
              let elem = document.getElementsByClassName('jc-Indicator')[0];
              elem.parentNode?.removeChild(elem);
              selectionString = "";
            }
          }
        });
        awarenessTracker = true; 
      }
    });
    app.shell.add(panel, 'right', { rank: 500 });

    // Automatically add the comment widgets to the tracker as
    // they're added to the panel
    panel.commentAdded.connect(
      (_, comment) => void commentTracker.add(comment)
    );

    // Re-render the panel whenever the active cell changes
    nbTracker.activeCellChanged.connect((_, cells) => panel.update());

    addCommands(app, nbTracker, commentTracker, panel);

    // Add an entry to the drop-down menu for comments
    panel.commentMenu.addItem({ command: CommandIDs.deleteComment });


    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });

    app.contextMenu.addItem({
      command: CommandIDs.deleteComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 0
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
        const id = currentComment.activeID;
        const metadata = currentComment.metadata;
        if (id === currentComment.commentID) {
          deleteComment(metadata, id);
        } else {
          deleteReply(metadata, id, currentComment.commentID);
        }
        panel.update();
      }
    }
  });
}

export default plugin;
