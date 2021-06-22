import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog } from '@jupyterlab/apputils';
import * as Widgets from '@lumino/widgets';
import * as Icons from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';

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

    let panel = new Widgets.Panel();
    panel.id = "Comments";
    panel.title.icon = Icons.listIcon;
    app.shell.add(panel, 'right', {rank:500});
    panel.addClass('test');

    nbTracker.activeCellChanged.connect(
      (_, cells) => {
        panelRender(panel, nbTracker);
        //panel.node.textContent = cells?.model.metadata.get('comment')?.toString() as string;
        const comment: any = cells?.model.metadata.get('comment');
        console.log(comment.length);
      }
    );

    app.commands.addCommand(CommandIDs.addComment, {
      label: 'Add Comment',
      execute: async () => {
        const cell = nbTracker.currentWidget?.content.activeCell;
        if (cell == null) {
          return;
        }
        const comment: any = cell.model.metadata.get('comment');
        if(comment == null)
        {
          void InputDialog.getText({
            title: 'Enter Comment'
          }).then(value => {
            if (value.value != null) {
              cell.model.metadata.set('comment', [value.value]);
              console.log('set metadata of cell', cell.model.id);
              panelRender(panel, nbTracker);
            }
          });
        }
        else
        {
          void InputDialog.getText({
            title: 'Enter Reply'
          }).then(value => {
            if (value.value != null) {
              cell.model.metadata.set('comment', [...comment, value.value]);
              console.log('set metadata of cell', cell.model.id);
              panelRender(panel, nbTracker);
            }
          });
        }
      }
    });

    app.commands.addCommand(CommandIDs.renderComment, {
      label: 'Render Comment',
      execute: () => {
        const cell = nbTracker.currentWidget?.content.activeCell;
        if (cell == null) {
          return;
        }

        const comment = cell.model.metadata.get('comment');
        if (comment != null) {
          console.log(typeof comment);
          console.log(comment instanceof Array);
          alert(comment.toString());
        }
      }
    });

    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });

    app.contextMenu.addItem({
      command: CommandIDs.renderComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 14
    });
    
  }
};

export default plugin;

function panelRender(panels: Widgets.Panel, tracker: INotebookTracker)
{
  
  while(panels.widgets.length > 0)
  {
    panels.widgets[panels.widgets.length-1].dispose();
  }
  
  const cell = tracker.currentWidget?.content.activeCell;
  const comment: any = cell?.model.metadata.get('comment') as string;
  var i = 0;
  while(i < comment.length)
  {
    let newWidget = new Widgets.Panel();
    newWidget.addClass('subclass');
    newWidget.node.textContent = comment[i];
    panels.addWidget(newWidget);
    i++;
  }
  return;
}
