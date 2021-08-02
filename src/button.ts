import { CreateCommentIcon } from './icons';
import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';

export class NewCommentButton extends Widget {
  constructor() {
    super({ node: Private.createNode() });
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('click', this);
  }

  protected onAfterDetach(msg: Message): void {
    super.onAfterDetach(msg);
    this.node.removeEventListener('click', this);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case 'click':
        this._handleClick(event as MouseEvent);
        break;
    }
  }

  private _handleClick(event: MouseEvent): void {
    this._onClick();
    this.close();
  }

  open(x: number, y: number, f: () => void): void {
    // Bail if button is already attached
    // if (this.isAttached) {
    //   return;
    // }

    // Get position/size of main viewport
    const px = window.pageXOffset;
    const py = window.pageYOffset;
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;

    // Reset position
    const style = this.node.style;
    style.top = '';
    style.left = '';
    style.visibility = 'hidden';

    if (!this.isAttached) {
      Widget.attach(this, document.body);
    }

    const { width, height } = this.node.getBoundingClientRect();

    // Constrain button to the viewport
    if (x + width > px + cw) {
      x = px + cw - width;
    }
    if (y + height > py + ch) {
      if (y > py + ch) {
        y = py + ch - height;
      } else {
        y = y - height;
      }
    }

    // Add onclick function
    this._onClick = f;

    // Update button position and visibility
    style.top = `${Math.max(0, y)}px`;
    style.left = `${Math.max(0, x)}px`;
    style.visibility = '';
  }

  private _onClick: () => void = () =>
    console.warn('no onClick function registered', this);
}

export namespace Private {
  export function createNode() {
    const node = document.createElement('div');
    node.className = 'jc-Indicator';
    const icon = CreateCommentIcon.element();
    node.appendChild(icon);
    return node;
  }
}