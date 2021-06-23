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

    let codeEditor = new CodeEditorWrapper(
      {
        factory: InputArea.defaultContentFactory.editorFactory,
        model: new CodeEditor.Model()
      }
    );
    
    codeEditor.addClass('subclass-editor');
    panel.addWidget(codeEditor);

    document.addEventListener('keydown', function(event){
      if(event.key == 'Enter' && codeEditor.editor.hasFocus())
      {
        commentInput(panel, nbTracker, codeEditor);
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
  const comment: any = cell?.model.metadata.get('comment') as string;
  let i = 0;
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

function commentInput(panels: Widgets.Panel, tracker: INotebookTracker, wrapper: CodeEditorWrapper)
{
  const cell = tracker.currentWidget?.content.activeCell;
  const cellArr : any = cell?.model.metadata.get('comment');
  const comment : any  = wrapper.model.value.text;
  console.log(comment);
  if(cellArr == null){
    cell?.model.metadata.set('comment', [comment])
  }else{
    cell?.model.metadata.set('comment', [...cellArr, comment]);
  }
  panelRender(panels, tracker);
  wrapper.model.value.text = "";
}

export default plugin;