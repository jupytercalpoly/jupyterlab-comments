import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { PartialJSONValue, Token } from '@lumino/coreutils';
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
import { CommentFileModelFactory, ICommentOptions } from './model';
import { ICellComment } from './commentformat';
import { CodeEditorWrapper } from '@jupyterlab/codeeditor';

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

    const button = panel.button;

    function openButton(x: number, y: number, anchor: HTMLElement): void {
      button.open(
        x,
        y,
        () => {
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

          panel.mockComment(
            {
              identity: getIdentity(model.awareness),
              type: 'cell-selection',
              source: cell
            },
            index
          );
        },
        anchor
      );
    }

    let currAwareness: Awareness;
    let awarenessHandler: () => void;
    let onMouseup: (event: MouseEvent) => void;

    // This updates the indicator and scrolls to the comments of the selected cell
    // when the active cell changes.
    nbTracker.activeCellChanged.connect((_, cell: Cell | null) => {
      // Remove the old awareness handler if one exists.
      if (
        currAwareness != null &&
        awarenessHandler != null &&
        onMouseup != null
      ) {
        document.removeEventListener('mouseup', onMouseup);
        currAwareness.off('change', awarenessHandler);
        button.close();
      }

      if (cell == null || panel.model == null) {
        return;
      }

      // Scroll to the first comment associated with the currently selected cell.
      for (let comment of panel.model.comments) {
        if (comment.type === 'cell' || comment.type === 'cell-selection') {
          const cellComment = comment as ICellComment;
          if (cellComment.target.cellID === cell.model.id) {
            panel.scrollToComment(cellComment.id);
            break;
          }
        }
      }

      // Open add comment button when mouse is released after selection
      onMouseup = (_: MouseEvent): void => {
        const { right, top, height } =
          cell.editorWidget.node.getBoundingClientRect();
        const node = nbTracker.currentWidget!.content.node;
        openButton(right - 10, top + height / 2 - 10, node);
      };

      awarenessHandler = (): void => {
        const { start, end } = cell.editor.getSelection();

        if (start.column !== end.column || start.line !== end.line) {
          document.addEventListener('mouseup', onMouseup, { once: true });
        } else {
          button.close();
        }
      };

      currAwareness = (nbTracker.currentWidget!.model!.sharedModel as YNotebook)
        .awareness;
      currAwareness.on('change', awarenessHandler);
    });

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

        let type;
        const { start, end } = cell.editor.getSelection();
        if (start.column === end.column && start.line === end.line) {
          type = 'cell';
        } else {
          type = 'cell-selection';
        }

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

    const panel = new CommentPanel(
      {
        commands: app.commands,
        registry,
        docManager,
        shell
      },
      renderer
    );

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

    // panel.revealed.connect(() => panel.update());
    shell.currentChanged.connect((_, args) => {
      console.warn('yes?: ', args.newValue instanceof DocumentWidget);
      if (args.newValue != null && args.newValue instanceof DocumentWidget) {
        const docWidget = args.newValue as DocumentWidget;
        const path = docWidget.context.path;
        if (path !== '') {
          void panel.loadModel(docWidget.context.path);
        }
      } else {
        try {
          void panel.loadModel('');
        } catch (e) {
          console.warn('no file for Launcher!');
        }
      }
    });

    let currAwareness: Awareness | null = null;

    //commenting stuff for non-notebook/json files
    shell.currentChanged.connect((_, changed) => {
      if (changed.newValue == null || panel.model == null) {
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

      editorWidget.node.oncontextmenu = () => {
        void InputDialog.getText({ title: 'Enter Comment' }).then(value =>
          panel.model?.addComment({
            type: 'text-selection',
            text: value.value ?? 'invalid!',
            source: editorWidget,
            identity: getIdentity(panel.model.awareness)
          })
        );
      };

      const handler = (): void => {
        //handler will be populated in the future the log is there so that the linter
        //does not call an error
        console.log('');
      };

      if (currAwareness != null) {
        currAwareness.off('change', handler);
      }

      currAwareness = (editorWidget.editor.model.sharedModel as YFile)
        .awareness;
      currAwareness.on('change', handler);
    });

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
    panel.commentAdded.connect(() => shell.activateById(panel.id));

    // app.commands.addCommand('addComment', {
    //   label: 'Add Document Comment',
    //   execute: () => {
    //     const model = panel.model!;
    //     model.addComment({
    //       text: UUID.uuid4(),
    //       type: 'test',
    //       target: null,
    //       identity: randomIdentity()
    //     });
    //     panel.update();
    //   },
    //   isEnabled: () => panel.model != null
    // });

    // app.commands.addCommand('saveCommentFile', {
    //   label: 'Save Comment File',
    //   execute: () => void panel.fileWidget!.context.save(),
    //   isEnabled: () => panel.model != null
    // });

    // app.contextMenu.addItem({
    //   command: 'addComment',
    //   selector: '.lm-Widget',
    //   rank: 0
    // });

    // app.contextMenu.addItem({
    //   command: 'saveCommentFile',
    //   selector: '.lm-Widget',
    //   rank: 1
    // });

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
