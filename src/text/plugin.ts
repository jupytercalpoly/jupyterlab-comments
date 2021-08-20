import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { getIdentity, ICommentPanel } from '../api';
import { WidgetTracker } from '@jupyterlab/apputils';
import { CodeEditorWrapper } from '@jupyterlab/codeeditor';
import { TextSelectionCommentFactory } from './commentfactory';
import { TextSelectionCommentWidgetFactory } from './widgetfactory';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { ITextSelectionComment } from './commentformat';
import { Awareness } from 'y-protocols/awareness';
import { YFile } from '@jupyterlab/shared-models';
import { Widget } from '@lumino/widgets';

export const textCommentingPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-comments:commenting-api',
  autoStart: true,
  requires: [ICommentPanel, ILabShell],
  activate: (app: JupyterFrontEnd, panel: ICommentPanel, shell: ILabShell) => {
    const commentRegistry = panel.commentRegistry;
    const commentWidgetRegistry = panel.commentWidgetRegistry;

    const editorTracker = new WidgetTracker<CodeEditorWrapper>({
      namespace: 'code-editor-wrappers'
    });

    commentRegistry.addFactory(new TextSelectionCommentFactory());

    commentWidgetRegistry.addFactory(
      new TextSelectionCommentWidgetFactory({
        commentRegistry,
        tracker: editorTracker
      })
    );

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

    let currAwareness: Awareness | null = null;
    let handler: () => void;
    let onMouseup: (event: MouseEvent) => void;

    //commenting stuff for non-notebook/json files
    shell.currentChanged.connect(async (_, changed) => {
      if (currAwareness != null && handler != null && onMouseup != null) {
        document.removeEventListener('mouseup', onMouseup);
        currAwareness.off('change', handler);
        button.close();
      }
      if (changed.newValue == null /*|| panel.model == null*/) {
        return;
      }
      const editorWidget = Private.getEditor(changed.newValue);
      if (editorWidget == null) {
        return;
      }

      if (!editorTracker.has(editorWidget)) {
        await editorTracker.add(editorWidget);
      }
      editorWidget.node.focus();
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
  }
};

namespace Private {
  export function getEditor(widget: Widget): CodeEditorWrapper | undefined {
    if (!widget.hasClass('jp-Document')) {
      return;
    }

    const content = (widget as DocumentWidget).content;
    if (!content.hasClass('jp-FileEditor')) {
      return;
    }

    return content as CodeEditorWrapper;
  }
}

export default textCommentingPlugin;
