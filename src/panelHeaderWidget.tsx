import * as React from 'react';

import { Widget } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';

import {getIdentity} from './utils';

import { Awareness } from 'y-protocols/awareness';



class PanelHeader extends ReactWidget {
  constructor(options: any){
      super();
      this._awareness  = options;
  }

  UserIdentity(): JSXElement {
    return (
      <>
        <div>My Widget</div>
        {getIdentity(this._awareness)}
      </>
    );
  }
  render() {
    return <UserIdentity awareness={this._awareness}/>;
  }
  private _awareness: Awareness;
}
// export const panelHeader: Widget = new PanelHeader();
