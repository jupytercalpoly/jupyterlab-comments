import { Panel } from '@lumino/widgets';
import { UUID } from '@lumino/coreutils';
import { listIcon } from '@jupyterlab/ui-components';

export class CommentPanel extends Panel {
  constructor(options?: Panel.IOptions) {
    super(options);
    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = listIcon;
    this.addClass('jc-CommentPanel');
  }
}
