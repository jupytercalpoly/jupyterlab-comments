import * as React from 'react';

import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import { getIdentity, setIdentityName } from './utils';

import { Awareness } from 'y-protocols/awareness';

import { CommentsHubIcon, CreateCommentIcon } from './icons';

import { caretDownEmptyThinIcon, editIcon } from '@jupyterlab/ui-components';
import { each } from '@lumino/algorithm';

import { Signal } from '@lumino/signaling';
import { ILabShell } from '@jupyterlab/application';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { getComments, setComments } from './comments';
import { INotebookTracker } from '@jupyterlab/notebook';
/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type IdentityProps = {
  awareness: Awareness | undefined;
  tracker: INotebookTracker;
};

type DocumentProps = {
  Shell: ILabShell;
};

function updateCommentIdentities(newName: string, oldName: string, tracker: INotebookTracker): void {
    const model = tracker.currentWidget?.model;
    if (model == null) {
      console.warn(
        'Either no current widget or no widget model; aborting identities update'
      );
      return;
    }
    each(model.cells, cell => {
      const sharedModel = cell.sharedModel;
      const comments = getComments(sharedModel);
      if (comments == null) {
        return;
      }
      for (let comment of comments){
        if (comment.identity.name == oldName){
          comment.identity.name = newName
        }
      }
      setComments(sharedModel, comments)
    });
  }

function UserIdentity(props: IdentityProps): JSX.Element {
  const { awareness, tracker } = props;
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
      if (target.textContent == '' || target.textContent == null) {
        target.textContent = getIdentity(awareness).name;
      } else if (target.textContent) {
        let old_name = awareness.getLocalState()!['user']['name'];
        setIdentityName(awareness, target.textContent);
        updateCommentIdentities(target.textContent, old_name, tracker);
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
    const { shell, tracker } = options;
    this._shell = shell;
    this._tracker = tracker;
    this._renderNeeded.connect((_, aware) => {
      this._awareness = aware;
    });
  }

  

  render(): ReactRenderElement {
    return (
      <div className="jc-panelHeader">
        <div className="jc-panelHeader-left">
          <UseSignal signal={this._renderNeeded}>
            {() => (
              <UserIdentity
                awareness={this._awareness}
                tracker={this._tracker}
              />
            )}
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

  get tracker(): INotebookTracker {
    return this._tracker;
  }
  private _awareness: Awareness | undefined;
  private _shell: ILabShell;
  private _tracker: INotebookTracker;
  private _renderNeeded: Signal<this, Awareness> = new Signal<this, Awareness>(
    this
  );
}

export namespace PanelHeader {
  export interface IOptions {
    shell: ILabShell;
    tracker: INotebookTracker;
  }
}
