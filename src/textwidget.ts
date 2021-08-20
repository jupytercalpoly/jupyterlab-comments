import { CodeEditorWrapper } from '@jupyterlab/codeeditor';
import { CommentWidget } from './widget';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { ITextSelectionComment } from './commentformat';
import { truncate } from './utils';
import * as CodeMirror from 'codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { PartialJSONValue } from '@lumino/coreutils';
import { CommentFactory, CommentWidgetFactory } from './factory';
import { CommentFileModel } from './model';
import { WidgetTracker } from '@jupyterlab/apputils';

export class TextSelectionCommentWidget extends CommentWidget<
  CodeEditorWrapper,
  ITextSelectionComment
> {
  constructor(options: TextSelectionCommentWidget.IOptions) {
    super(options);

    this._mark = options.mark;
  }

  dispose(): void {
    this._mark.clear();
    super.dispose();
  }

  toJSON(): PartialJSONValue {
    const json = super.toJSON();

    const mark = this._mark;
    if (mark == null) {
      console.warn(
        'No mark found--serializing based on initial text selection position',
        this
      );
      return json;
    }

    const range = mark.find();
    if (range == null) {
      console.warn(
        'Mark no longer exists in code editor--serializing based on initial text selection position',
        this
      );
      return json;
    }

    const textSelectionComment = json as ITextSelectionComment;
    const { from, to } = range as CodeMirror.MarkerRange;
    textSelectionComment.target.start = Private.toCodeEditorPosition(from);
    textSelectionComment.target.end = Private.toCodeEditorPosition(to);

    return textSelectionComment;
  }

  getPreview(): string | undefined {
    if (this.isMock || this._mark == null) {
      return Private.getMockCommentPreviewText(this._doc, this.comment!);
    }

    const range = this._mark.find();
    if (range == null) {
      return '';
    }

    const { from, to } = range as CodeMirror.MarkerRange;
    const text = this._doc.getRange(from, to);

    return truncate(text, 140);
  }

  get element(): HTMLElement | undefined {
    return (
      document.getElementById(`CommentMark-${this.commentID}`) ?? undefined
    );
  }

  private get _doc(): CodeMirror.Doc {
    return Private.docFromWrapper(this.target);
  }

  private _mark: CodeMirror.TextMarker;
}

export namespace TextSelectionCommentWidget {
  export interface IOptions
    extends CommentWidget.IOptions<CodeEditorWrapper, ITextSelectionComment> {
    mark: CodeMirror.TextMarker;
  }
}

export class TextSelectionCommentFactory extends CommentFactory<ITextSelectionComment> {
  createComment(
    options: CommentFactory.ICommentOptions<CodeEditorWrapper>
  ): ITextSelectionComment {
    const comment = super.createComment(options);
    const wrapper = options.source;

    let { start, end } = wrapper.editor.getSelection();

    if (
      start.line > end.line ||
      (start.line === end.line && start.column > end.column)
    ) {
      [start, end] = [end, start];
    }

    comment.target = { start, end };

    return comment;
  }

  readonly type = 'text-selection';
}

export class TextSelectionCommentWidgetFactory extends CommentWidgetFactory<
  CodeEditorWrapper,
  ITextSelectionComment
> {
  constructor(options: TextSelectionCommentWidgetFactory.IOptions) {
    super(options);

    this._tracker = options.tracker;
  }

  createWidget(
    comment: ITextSelectionComment,
    model: CommentFileModel,
    target?: CodeEditorWrapper
  ): TextSelectionCommentWidget | undefined {
    const wrapper = target ?? this._tracker.currentWidget;
    if (wrapper == null) {
      console.error('No CodeEditorWrapper found for comment', comment);
      return;
    }

    const mark = Private.markCommentSelection(
      Private.docFromWrapper(wrapper),
      comment
    );

    return new TextSelectionCommentWidget({
      comment,
      model,
      mark,
      target: wrapper
    });
  }

  readonly commentType = 'text-selection';

  readonly widgetType = 'text-selection';

  private _tracker: WidgetTracker<CodeEditorWrapper>;
}

export namespace TextSelectionCommentWidgetFactory {
  export interface IOptions extends CommentWidgetFactory.IOptions {
    tracker: WidgetTracker<CodeEditorWrapper>;
  }
}

namespace Private {
  export function docFromWrapper(wrapper: CodeEditorWrapper): CodeMirror.Doc {
    return (wrapper.editor as CodeMirrorEditor).doc;
  }

  //function that converts a line-column pairing to an index
  export function lineToIndex(str: string, line: number, col: number): number {
    if (line == 0) {
      return col;
    } else {
      let arr = str.split('\n');
      return arr.slice(0, line).join('\n').length + col + 1;
    }
  }

  export function markCommentSelection(
    doc: CodeMirror.Doc,
    comment: ITextSelectionComment
  ): CodeMirror.TextMarker {
    const color = comment.identity.color;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const { start, end } = comment.target;
    const forward =
      start.line < end.line ||
      (start.line === end.line && start.column <= end.column);
    const anchor = toCodeMirrorPosition(forward ? start : end);
    const head = toCodeMirrorPosition(forward ? end : start);

    return doc.markText(anchor, head, {
      className: 'jc-Highlight',
      title: `${comment.identity.name}: ${truncate(comment.text, 140)}`,
      css: `background-color: rgba( ${r}, ${g}, ${b}, 0.15)`,
      attributes: { id: `CommentMark-${comment.id}` }
    });
  }

  export function toCodeMirrorPosition(
    pos: CodeEditor.IPosition
  ): CodeMirror.Position {
    return {
      line: pos.line,
      ch: pos.column
    };
  }

  export function toCodeEditorPosition(
    pos: CodeMirror.Position
  ): CodeEditor.IPosition {
    return {
      line: pos.line,
      column: pos.ch
    };
  }

  export function getMockCommentPreviewText(
    doc: CodeMirror.Doc,
    comment: ITextSelectionComment
  ): string {
    const { start, end } = comment.target;
    const forward =
      start.line < end.line ||
      (start.line === end.line && start.column <= end.column);
    const from = toCodeMirrorPosition(forward ? start : end);
    const to = toCodeMirrorPosition(forward ? end : start);
    const text = doc.getRange(from, to);

    return truncate(text, 140);
  }
}
