import { CommentFileModel, CommentWidgetFactory } from '../api';
import { CodeEditorWrapper } from '@jupyterlab/codeeditor';
import { ITextSelectionComment } from './commentformat';
import { TextSelectionCommentWidget } from './widget';
import { docFromWrapper, markTextSelection } from './utils';
import { WidgetTracker } from '@jupyterlab/apputils';

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

    const mark = markTextSelection(docFromWrapper(wrapper), comment);

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
