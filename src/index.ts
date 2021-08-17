import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Token } from '@lumino/coreutils';
import { YFile, YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getIdentity } from './utils';
import { CommentPanel, ICommentPanel } from './panel';
import { CommentWidget } from './widget';
import { Cell } from '@jupyterlab/cells';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { CommentRegistry, ICommentRegistry } from './registry';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';
import {
  CellCommentFactory,
  CellSelectionCommentFactory,
  TestCommentFactory,
  TextSelectionCommentFactory
} from './factory';
import { Menu } from '@lumino/widgets';
import { CommentFileModelFactory } from './model';
import { ICellComment, ITextSelectionComment } from './commentformat';
import { CodeEditor, CodeEditorWrapper } from '@jupyterlab/codeeditor';

namespace CommandIDs {
  export const addComment = 'jl-comments:add-comment';
  export const deleteComment = 'jl-comments:delete-comment';
  export const editComment = 'jl-comments:edit-comment';
  export const replyToComment = 'jl-comments:reply-to-comment';
  export const addNotebookComment = 'jl-comments:add-notebook-comment';
  export const save = 'jl-comments:save';
}

const ICommentRegistry = new Token<ICommentRegistry>(
  'jupyterlab-comments:comment-registry'
);

export type CommentTracker = WidgetTracker<CommentWidget<any>>;

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

    app.commands.addCommand(CommandIDs.addNotebookComment, {
      label: 'Add Comment',
      execute: () => {
        const cell = nbTracker.activeCell;
        if (cell == null) {
          return;
        }

        const model = panel.model;
        if (model == null) {
          return;
        }

        const comments = model.comments;
        let index = comments.length;
        for (let i = comments.length; i > 0; i--) {
          const comment = comments.get(i - 1) as ICellComment;
          if (comment.target.cellID === cell.model.id) {
            index = i;
          }
        }

        const { start, end } = cell.editor.getSelection();
        const type =
          start.column === end.column && start.line === end.line
            ? 'cell'
            : 'cell-selection';

        panel.mockComment(
          {
            identity: getIdentity(model.awareness),
            type,
            source: cell
          },
          index
        );
      }
    });

    // This updates the indicator and scrolls to the comments of the selected cell
    // when the active cell changes.
    let currentCell: Cell | null = null;
    nbTracker.activeCellChanged.connect((_, cell: Cell | null) => {
      // Clean up old mouseup listener
      document.removeEventListener('mouseup', onMouseup);

      currentCell = cell;
      panel.button.close();

      // panel.model can be null when the notebook is first loaded
      if (cell == null || panel.model == null) {
        return;
      }

      // Scroll to the first comment associated with the currently selected cell.
      for (let comment of panel.model.comments) {
        if (comment.type === 'cell-selection' || comment.type === 'cell') {
          const cellComment = comment as ICellComment;
          if (cellComment.target.cellID === cell.model.id) {
            panel.scrollToComment(cellComment.id);
            break;
          }
        }
      }
    });

    let currentSelection: CodeEditor.IRange;

    // Opens add comment button on the current cell when the mouse is released
    // after a text selection
    const onMouseup = (_: MouseEvent): void => {
      if (currentCell == null) {
        return;
      }

      const editor = currentCell.editor;
      const { top } = editor.getCoordinateForPosition(currentSelection.start);
      const { bottom } = editor.getCoordinateForPosition(currentSelection.end);
      const { right } = currentCell.editorWidget.node.getBoundingClientRect();

      const node = nbTracker.currentWidget!.content.node;

      panel.button.open(
        right - 10,
        (top + bottom) / 2 - 10,
        () => app.commands.execute(CommandIDs.addNotebookComment),
        node
      );
    };

    // Adds a single-run mouseup listener whenever a text selection is made in a cell
    const awarenessHandler = (): void => {
      if (currentCell == null) {
        return;
      }

      currentSelection = currentCell.editor.getSelection();
      const { start, end } = currentSelection;

      if (start.column !== end.column || start.line !== end.line) {
        document.addEventListener('mouseup', onMouseup, { once: true });
      } else {
        panel.button.close();
      }
    };

    let lastAwareness: Awareness | null = null;
    nbTracker.currentChanged.connect((_, notebook: NotebookPanel | null) => {
      if (notebook == null) {
        lastAwareness = null;
        return;
      }

      // Clean up old awareness handler
      if (lastAwareness != null) {
        lastAwareness.off('change', awarenessHandler);
      }

      // Add new awareness handler
      const model = notebook.model!.sharedModel as YNotebook;
      model.awareness.on('change', awarenessHandler);

      lastAwareness = model.awareness;
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
  requires: [
    ICommentRegistry,
    ILabShell,
    IDocumentManager,
    IRenderMimeRegistry
  ],
  provides: ICommentPanel,
  activate: (
    app: JupyterFrontEnd,
    registry: ICommentRegistry,
    shell: ILabShell,
    docManager: IDocumentManager,
    renderer: IRenderMimeRegistry
  ): CommentPanel => {
    const filetype: DocumentRegistry.IFileType = {
      contentType: 'file',
      displayName: 'comment',
      extensions: ['.comment'],
      fileFormat: 'json',
      name: 'comment',
      mimeTypes: ['application/json']
    };

    const commentTracker = new WidgetTracker<CommentWidget<any>>({
      namespace: 'comment-widgets'
    });

    const editorTracker = new WidgetTracker<CodeEditorWrapper>({
      namespace: 'code-editor-wrappers'
    });

    void registry.addFactory(new TestCommentFactory());
    void registry.addFactory(
      new TextSelectionCommentFactory({ type: 'text-selection' }, editorTracker)
    );

    const panel = new CommentPanel({
      commands: app.commands,
      registry,
      docManager,
      shell,
      renderer
    });

    // Create the directory holding the comments.
    void panel.pathExists(panel.pathPrefix).then(exists => {
      const contents = docManager.services.contents;
      if (!exists) {
        void contents
          .newUntitled({
            path: '/',
            type: 'directory'
          })
          .then(model => {
            void contents.rename(model.path, panel.pathPrefix);
          });
      }
    });

    addCommands(app, commentTracker, panel);

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

    // Add the panel to the shell's right area.
    shell.add(panel, 'right', { rank: 600 });
    const button = panel.button;

    function openButton(x: number, y: number, anchor: HTMLElement): void {
      button.open(
        x,
        y,
        () => {
          let editorWidget = (shell.currentWidget as DocumentWidget)
            .content as CodeEditorWrapper;

          if (editorWidget == null) {
            return;
          }

          const model = panel.model;
          if (model == null) {
            return;
          }

          const comments = model.comments;
          let index = comments.length;
          let { start, end } = editorWidget.editor.getSelection();
          //backwards selection compatibility
          if (
            start.line > end.line ||
            (start.line === end.line && start.column > end.column)
          ) {
            [start, end] = [end, start];
          }

          for (let i = 0; i < comments.length; i++) {
            const comment = comments.get(i) as ITextSelectionComment;
            let sel = comment.target;
            let commentStart = sel.start;
            if (
              start.line < commentStart.line ||
              (start.line === commentStart.line &&
                start.column <= commentStart.column)
            ) {
              index = i;
              break;
            }
          }

          panel.mockComment(
            {
              identity: getIdentity(model.awareness),
              type: 'text-selection',
              source: editorWidget
            },
            index
          );
        },
        anchor
      );
    }

    shell.currentChanged.connect((_, args) => {
      if (args.newValue != null && args.newValue instanceof DocumentWidget) {
        const docWidget = args.newValue as DocumentWidget;
        docWidget.context.ready
          .then(() => {
            void panel.loadModel(docWidget.context);
          })
          .catch(() => {
            console.warn('unable to load');
          });
      }
    });

    let currAwareness: Awareness | null = null;
    let handler: () => void;
    let onMouseup: (event: MouseEvent) => void;

    //commenting stuff for non-notebook/json files
    shell.currentChanged.connect((_, changed) => {
      if (currAwareness != null && handler != null && onMouseup != null) {
        document.removeEventListener('mouseup', onMouseup);
        currAwareness.off('change', handler);
        button.close();
      }
      if (changed.newValue == null /*|| panel.model == null*/) {
        return;
      }
      let invalids = ['json', 'ipynb'];
      let editorWidget = (changed.newValue as DocumentWidget)
        .content as CodeEditorWrapper;
      if (
        invalids.includes(changed.newValue.title.label.split('.').pop()!) ||
        editorWidget.editor == null
      ) {
        return;
      }
      if (!editorTracker.has(editorWidget)) {
        editorTracker.add(editorWidget).catch(() => {
          console.warn('could not add widget');
        });
      }
      editorWidget.editor.focus();

      onMouseup = (_: MouseEvent): void => {
        const { right } = editorWidget.node.getBoundingClientRect();
        const { start, end } = editorWidget.editor.getSelection();
        const coord1 = editorWidget.editor.getCoordinateForPosition(start);
        const coord2 = editorWidget.editor.getCoordinateForPosition(end);
        const node = editorWidget.parent?.parent?.node ?? editorWidget.node;
        openButton(right - 10, (coord1.top + coord2.bottom) / 2 - 10, node);
      };

      handler = (): void => {
        const { start, end } = editorWidget.editor.getSelection();

        if (start.column !== end.column || start.line !== end.line) {
          document.addEventListener('mouseup', onMouseup, { once: true });
        } else {
          button.close();
        }
      };

      if (currAwareness != null) {
        currAwareness.off('change', handler);
      }

      currAwareness = (editorWidget.editor.model.sharedModel as YFile)
        .awareness;
      currAwareness.on('change', handler);
    });

    // Update comment widget tracker when model changes
    panel.modelChanged.connect((_, fileWidget) => {
      if (fileWidget != null) {
        fileWidget.widgets.forEach(
          widget => void commentTracker.add(widget as CommentWidget<any>)
        );
        fileWidget.commentAdded.connect(
          (_, commentWidget) => void commentTracker.add(commentWidget)
        );
      }
    });

    // Reveal the comment panel when a comment is added.
    panel.commentAdded.connect((_, comment) => {
      const identity = comment.identity;

      // If you didn't make the comment, ignore it
      // Comparing ids would be better but they're not synchronized across Docs/awarenesses
      if (identity == null || identity.name !== panel.localIdentity.name) {
        return;
      }

      // Automatically opens panel when a document with comments is opened,
      // or when the local user adds a new comment
      if (!panel.isVisible) {
        shell.activateById(panel.id);
        if (comment.text === '') {
          comment.openEditActive();
        }
      }

      panel.scrollToComment(comment.id);
    });

    app.contextMenu.addItem({
      command: CommandIDs.save,
      selector: '.jc-CommentPanel'
    });

    return panel;
  }
};

function addCommands(
  app: JupyterFrontEnd,
  commentTracker: CommentTracker,
  panel: ICommentPanel
): void {
  app.commands.addCommand(CommandIDs.save, {
    label: 'Save Comments',
    execute: () => {
      const fileWidget = panel.fileWidget;
      if (fileWidget == null) {
        return;
      }

      void fileWidget.context.save();
      console.log('saved');
    }
  });

  app.commands.addCommand(CommandIDs.deleteComment, {
    label: 'Delete Comment',
    execute: () => {
      const currentComment = commentTracker.currentWidget;
      if (currentComment != null) {
        currentComment.deleteActive();
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

const plugins: JupyterFrontEndPlugin<any>[] = [
  notebookCommentsPlugin,
  commentRegistryPlugin,
  jupyterCommentingPlugin
];
export default plugins;
