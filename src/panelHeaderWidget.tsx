import * as React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';

import {getIdentity} from './utils';

import { Awareness } from 'y-protocols/awareness';

import {CommentsHubIcon, CreateCommentIcon} from './icons';

import {caretDownEmptyIcon} from '@jupyterlab/ui-components'

/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type IdentityProps = {
  awareness: Awareness | undefined;
  className: string;
};

  // Awareness doesn't work unfortunatly 
function UserIdentity(props: IdentityProps): JSX.Element {
  const { awareness } = props;
  const className = props.className || '';
  return (
    <div className={className}>
      {awareness != undefined && getIdentity(awareness).name}

    </div>
  );
}

// function DocumentName(props:any): JSX.Element {
//     const filename = props.name
//     return (
//             <p>{filename}</p>
//     )
// }

export class PanelHeader extends ReactWidget {
  constructor(options: PanelHeader.IOptions) {
    super();
    const { awareness, filename } = options;
    this._awareness = awareness;
    this._filename = filename;
  }

  render(): ReactRenderElement {
    return (
      <div className="jc-panelHeader">
        <div className="jc-panelHeader-left">
          <UserIdentity
            awareness={this._awareness}
            className="jc-panelHeader-identity"
          />
          <p className="jc-panelHeader-filename">{this._filename}</p>
        </div>

        <div className="jc-panelHeader-right">
          <div style={{ 'display': 'flex' }}><p className="jc-panelHeader-dropdown">All </p><caretDownEmptyIcon.react fontSize="12px"/></div>
          <div><CreateCommentIcon.react  /></div>
          <div><CommentsHubIcon.react  /></div>
        </div>
      </div>
    );
  }
  private _awareness: Awareness | undefined;
  private _filename: string | undefined;
}

export namespace PanelHeader {
  export interface IOptions {
    awareness: Awareness | undefined;
    filename: string | undefined;
  }
}
