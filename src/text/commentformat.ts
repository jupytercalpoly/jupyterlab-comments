import { IComment } from '../api';
import { CodeEditor } from '@jupyterlab/codeeditor';

export interface ITextSelectionComment extends IComment {
  type: 'text-selection';
  target: {
    start: CodeEditor.IPosition;
    end: CodeEditor.IPosition;
  };
}
