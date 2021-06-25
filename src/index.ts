import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog } from '@jupyterlab/apputils';
import * as Widgets from '@lumino/widgets';
import * as Icons from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeEditor, CodeEditorWrapper } from '@jupyterlab/codeeditor';
import { InputArea } from '@jupyterlab/cells';

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

    let insertion = new CodeEditorWrapper(
      {
        factory: InputArea.defaultContentFactory.editorFactory,
        model: new CodeEditor.Model()
      }
    );
    insertion.addClass('subclass-editor');
    panel.addWidget(insertion);
    insertion.node.addEventListener('keydown', (e) => {
      if(e.key == 'Enter'){
        commentInput(panel, nbTracker, insertion);
      }
    });

    nbTracker.activeCellChanged.connect(
      (_, cells) => {
        panelRender(panel, nbTracker);
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

    Text
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

function panelRender(panels: Widgets.Panel, tracker: INotebookTracker)
{
  while(panels.widgets.length > 1)
  {
    panels.widgets[panels.widgets.length-1].dispose();
  }
  
  const cell = tracker.currentWidget?.content.activeCell;
  const comment: any = cell?.model.metadata.get('comment');
  let i = 0;
  while(i < comment.length)
  {
    let newWidget = new Widgets.Panel();
    newWidget.addClass('subclass');
    newWidget.node.textContent = comment[i];

    let addButton = new Widgets.Panel();
    addButton.addClass('button-below');
    addButton.node.textContent = "Reply";
    addButton.node.onclick = () => {
      let wrapper = new CodeEditorWrapper(
        {
          factory: InputArea.defaultContentFactory.editorFactory,
          model: new CodeEditor.Model()
        }
      );
      wrapper.addClass('subclass-editor');
      // not best practice atm (like with all eventListener callbacks) but will change in a bit
      wrapper.node.addEventListener('keydown', (e) => {
        if(e.key == 'Enter')
        {
          // NOTE: you can click the "add" button more than once but that'll mess stuff up
          // this is also quite convoluted (prolly can just use a "splice" tbh) so I'll switch over
          // to a better practice with the new schema
          let toAdd = wrapper.model.value.text;
          let newArr = [];
          let j = 0;
          let addFlag = 0;
          while(j < comment.length)
          {
            if(j == panels.widgets.indexOf(newWidget) && addFlag == 0)
            {
              newArr.push(toAdd.substring(0, toAdd.length-1));
              addFlag = 1;
            }
            else
            {
              newArr.push(comment[j]);
              //condition for last index
              if(j == comment.length-1 && addFlag == 0)
              {
                newArr.push(toAdd.substring(0, toAdd.length-1));
                addFlag = 1;
              }
              j++;
            }
            console.log(newArr);
          }
          cell?.model.metadata.set('comment', newArr);
          wrapper.dispose();
          panelRender(panels, tracker);
        }
      });
      panels.insertWidget(panels.widgets.indexOf(newWidget)+1, wrapper);
    };

    let deleteButton = new Widgets.Panel();
    deleteButton.addClass('button-below');
    deleteButton.node.textContent = "Delete";
    deleteButton.node.onclick = () => {
      let j = 0;
      let newArr = [];
      while(j < comment.length)
      {
        if(j != panels.widgets.indexOf(newWidget)-1)
        {
          newArr.push(comment[j]);
        }
        j++;
      }
      cell?.model.metadata.set('comment', newArr);
      panelRender(panels, tracker);
    }

    newWidget.addWidget(addButton);
    newWidget.addWidget(deleteButton);
    if(newWidget.node.textContent != null && newWidget.node.textContent?.length != 0)
    {
      console.log(newWidget.node.textContent?.length);
      panels.addWidget(newWidget);
    }
    i++;
  }
  return;
}

function commentInput(panels: Widgets.Panel, tracker: INotebookTracker, wrapper: CodeEditorWrapper)
{
  const cell = tracker.currentWidget?.content.activeCell;
  const cellArr : any = cell?.model.metadata.get('comment');
  const comment : string  = wrapper.model.value.text;
  if(cellArr == null){
    cell?.model.metadata.set('comment', [comment.substring(0, comment.length-1)])
  }else{
    cell?.model.metadata.set('comment', [...cellArr, comment.substring(0, comment.length-1)]);
  }
  panelRender(panels, tracker);
  wrapper.model.value.text = "";
}

export default plugin;
