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

    let awarenessTracker = false;
    let onHover = false;

    nbTracker.activeCellChanged.connect((_, cells) => {
      panel.update();
      if(awarenessTracker == false)
      {
        (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness.on('change', () => {
          if(window.getSelection()!.toString().length > 0)
          {
            if(document.getElementsByClassName('jc-Indicator').length == 0)
            {
              let indicator = document.createElement('div');
              indicator.className = 'jc-Indicator';
              indicator.onclick = () => {
                console.log('click');
              };
              indicator.onmouseover = () => {
                onHover = true;
              };
              indicator.onmouseout = () => {
                onHover = false;
              }
              nbTracker.activeCell?.node.childNodes[1].childNodes[1].
              childNodes[1].firstChild?.appendChild(indicator);
            }
          }
          else
          {
            if(document.getElementsByClassName('jc-Indicator').length != 0 && onHover == false)
            {
              let elem = document.getElementsByClassName('jc-Indicator')[0];
              elem.parentNode?.removeChild(elem);
            }
          }
        });
        awarenessTracker = true; 
      }
    });

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
