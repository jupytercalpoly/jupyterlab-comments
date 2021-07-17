import * as React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';

// import {getIdentity} from './utils';

import { Awareness } from 'y-protocols/awareness';

import {CreateCommentIcon } from './icons';

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

// Awareness doesn't work yet
function UserIdentity(props: IdentityProps): JSX.Element {
  const { awareness } = props;
  const className = props.className || '';
  return (
    <div className={className}>
      <p>[Your identity]</p>
      {/* {getIdentity(awareness)} */}
      {awareness != undefined && console.log(awareness)}
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
          <div><CreateCommentIcon.react tag="span" /></div>
          <div>2</div>
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
