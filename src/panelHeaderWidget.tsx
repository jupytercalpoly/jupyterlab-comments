import * as React from 'react';

import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import { getIdentity, setIdentityName } from './utils';

import { Awareness } from 'y-protocols/awareness';

import { editIcon, refreshIcon, saveIcon } from '@jupyterlab/ui-components';

import { ISignal, Signal } from '@lumino/signaling';
import { ILabShell } from '@jupyterlab/application';
import { CommentPanel } from './panel';
/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type IdentityProps = {
  awareness: Awareness | undefined;
  panel: CommentPanel;
};

function UserIdentity(props: IdentityProps): JSX.Element {
  const { awareness, panel } = props;
  const handleClick = () => {
    SetEditable(true);
  };
  const [editable, SetEditable] = React.useState(false);

  const IdentityDiv = () => {
    if (awareness != undefined) {
      return (
        <div
          contentEditable={editable}
          className={'jc-panelHeader-EditInputArea-' + editable}
          onKeyDown={handleKeydown}
          suppressContentEditableWarning={true}
        >
          {getIdentity(awareness).name}
        </div>
      );
    }
  };

  const handleKeydown = (event: React.KeyboardEvent): void => {
    const target = event.target as HTMLDivElement;
    if (event.key === 'Escape') {
      SetEditable(false);
      target.blur();
      return;
    } else if (event.key !== 'Enter') {
      return;
    } else if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (awareness != null) {
      const newName = target.textContent;
      if (newName == null || newName === '') {
        target.textContent = getIdentity(awareness).name;
      } else {
        setIdentityName(awareness, newName);
        panel.updateIdentity(awareness.clientID, newName);
      }
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

export class PanelHeader extends ReactWidget {
  constructor(options: PanelHeader.IOptions) {
    super();
    const { panel } = options;
    this._panel = panel;
    this.addClass('jc-panelHeader');
  }

  render(): ReactRenderElement {
    const save = () => {
      const fileWidget = this._panel.fileWidget;
      if (fileWidget == null) {
        return;
      }

      void fileWidget.context.save();
    };

    const refresh = () => {
      const fileWidget = this._panel.fileWidget;
      if (fileWidget == null) {
        return;
      }

      fileWidget.initialize();
    };

    return (
      <React.Fragment>
        <div className="jc-panelHeader-left">
          <UseSignal signal={this._renderNeeded}>
            {() => (
              <UserIdentity awareness={this._awareness} panel={this._panel} />
            )}
          </UseSignal>
          <UseSignal signal={this._panel.modelChanged}>
            {() => {
              const text = this._panel.sourcePath ?? '';
              const tooltip = this._panel.fileWidget?.context.path ?? '';

              return (
                <p className="jc-panelHeader-filename" title={tooltip}>
                  {text}
                </p>
              );
            }}
          </UseSignal>
        </div>

        <div className="jc-panelHeader-right">
          {/* Inline style added to align icons */}
          <div
            title="Save comments"
            onClick={save}
            style={{ position: 'relative', bottom: '2px' }}
          >
            <saveIcon.react className="jc-Button" />
          </div>
          <div title="Refresh comments" onClick={refresh}>
            <refreshIcon.react className="jc-Button" />
          </div>
        </div>
      </React.Fragment>
    );
  }

  /**
   * A signal emitted when a React re-render is required.
   */
  get renderNeeded(): ISignal<this, void> {
    return this._renderNeeded;
  }

  get awareness(): Awareness | undefined {
    return this._awareness;
  }
  set awareness(newValue: Awareness | undefined) {
    this._awareness = newValue;
    this._renderNeeded.emit(undefined);
  }

  private _awareness: Awareness | undefined;
  private _panel: CommentPanel;
  private _renderNeeded = new Signal<this, void>(this);
}

export namespace PanelHeader {
  export interface IOptions {
    shell: ILabShell;
    panel: CommentPanel;
  }
}
