import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { addComment } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getIdentity } from './utils';
import { CommentPanel } from './panel';

namespace CommandIDs {
  export const addComment = 'jl-chat:add-comment';
  export const renderComment = 'jl-chat:render-comment';
}

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, nbTracker: INotebookTracker) => {
    const panel = new CommentPanel({ tracker: nbTracker });
    app.shell.add(panel, 'right', { rank: 500 });

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

                    //create a temp div
                    let highlightDiv = document.createElement('div');
                    highlightDiv.className = 'jc-HighlightWrapper';
                    console.log((nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness.doc.getText());

                    //get the node to insert into docTree {{has to be this node from what it seems...}}
                    let toInsert = nbTracker.activeCell?.node.childNodes[1].childNodes[1].childNodes[1].
                    firstChild?.childNodes[5].firstChild?.firstChild?.firstChild;

                    //get the selection HTML
                    let selectionList = document.getElementsByClassName('CodeMirror-selected');
                    console.log(selectionList);
                    let len = selectionList?.length as number;
                    console.log(len);
                    
                    //loop thru selectionList to put into highlightDiv
                    let i = 0;
                    while(i < len){
                      let nnew = document.createElement('div');
                      nnew.className = 'jc-Highlight';
                      let newDiv = selectionList[i];
                      console.log(newDiv instanceof Node);
                      //console.log(newDiv.nodeType);
                      if(newDiv.parentElement?.className != 'jc-HighlightWrapper') {
                        highlightDiv.appendChild(newDiv);
                      }
                      i++;
                    }

                    //insert the node into the doc tree
                    toInsert?.insertBefore(highlightDiv, toInsert.firstChild);

                    console.log(text);
                    if(nbTracker.activeCell != null)
                    {
                      addComment(nbTracker.activeCell.model.metadata, comment);
                    }

                    panel.update();
                  }
                });
                console.log(nbTracker.activeCell?.node.textContent);
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

    //WIP selection end

    addCommands(app, nbTracker, panel);

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
            time: new Date(new Date().getTime()).toLocaleString()
          };

          addComment(cell.model.metadata, comment);

          panel.update();
        }
      });
    }
  });
}

export default plugin;
