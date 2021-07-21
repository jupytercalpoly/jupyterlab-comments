import * as React from 'react';

import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import { getIdentity, setIdentityName } from './utils';

import { Awareness } from 'y-protocols/awareness';

import { CommentsHubIcon, CreateCommentIcon } from './icons';

import { caretDownEmptyThinIcon, editIcon } from '@jupyterlab/ui-components';

import { Signal } from '@lumino/signaling';
import { ILabShell } from '@jupyterlab/application';
import { DocumentWidget } from '@jupyterlab/docregistry';
/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type IdentityProps = {
  awareness: Awareness | undefined;
};

type DocumentProps = {
  Shell: ILabShell;
};

function UserIdentity(props: IdentityProps): JSX.Element {
  const { awareness } = props;
  const handleClick = () => {
    SetEditable(true);
  };
  const [editable, SetEditable] = React.useState(false);
  let IdentityDiv = () => {
    if (awareness != undefined) {
      return (
        <div
          contentEditable={editable}
          className="jc-panelHeader-EditInputArea"
          onKeyDown={handleKeydown}
          suppressContentEditableWarning={true}
        >
          {getIdentity(awareness).name}
        </div>
      );
    }
  };
  const handleKeydown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      SetEditable(false);
      return;
    } else if (event.key !== 'Enter') {
      return;
    } else if (event.shiftKey) {
      return;
    }
    const target = event.target as HTMLDivElement;
    event.preventDefault();
    event.stopPropagation();

    if (awareness != undefined && target.textContent != null){
      setIdentityName(awareness, target.textContent);
    }
    SetEditable(false);
  };
  return (
    <div className="jc-panelHeader-identity-container">
      {IdentityDiv()}
      <div onClick={() => handleClick()}>
        <editIcon.react className="jc-panelHeader-editIcon" />
      </div>
    </div>
  );
}

function DocumentName(props: DocumentProps): JSX.Element {
  const [Filename, setFilename] = React.useState('');
  const { Shell } = props;
  Shell.currentChanged.connect((_, args) => {
    const docWidget = args.newValue as DocumentWidget;
    setFilename(docWidget.context.path);
  });
  return <p className="jc-panelHeader-filename">{Filename}</p>;
}

export class PanelHeader extends ReactWidget {
  constructor(options: PanelHeader.IOptions) {
    super();
    const { shell } = options;
    this._shell = shell;
    this._renderNeeded.connect((_, aware) => {
      this._awareness = aware;
    });
  }

  render(): ReactRenderElement {
    return (
      <div className="jc-panelHeader">
        <div className="jc-panelHeader-left">
          <UseSignal signal={this._renderNeeded}>
            {() => <UserIdentity awareness={this._awareness} />}
          </UseSignal>
          <DocumentName Shell={this._shell} />
        </div>

        <div className="jc-panelHeader-right">
          <div className="jc-panelHeader-dropdown">
            <p>All</p>
            <div>
              <caretDownEmptyThinIcon.react />
            </div>
          </div>
          <div>
            <CreateCommentIcon.react />
          </div>
          <div>
            <CommentsHubIcon.react />
          </div>
        </div>
      </div>
    );
  }

  /**
   * A signal emitted when a React re-render is required.
   */
  get renderNeeded(): Signal<this, Awareness> {
    return this._renderNeeded;
  }
  private _awareness: Awareness | undefined;
  private _shell: ILabShell;
  private _renderNeeded: Signal<this, Awareness> = new Signal<this, Awareness>(
    this
  );
}

export namespace PanelHeader {
  export interface IOptions {
    shell: ILabShell;
  }
}
