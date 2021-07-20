import { CommentFileModel } from './model';
import { ContentsManager } from '@jupyterlab/services';
import { IDocumentProviderFactory } from '@jupyterlab/docprovider';
import { ICommentRegistry } from './registry';
import { hashString } from './utils';
import { DocumentChange, YDocument } from '@jupyterlab/shared-models';
import { IComment } from './commentformat';

export class CommentModelFactory {
  constructor(options: CommentModelFactory.IOptions) {
    const { manager, docProviderFactory, registry } = options;

    this.manager = manager;
    this.docProviderFactory = docProviderFactory;
    this.registry = registry;
  }

  async createNew(sourcePath: string): Promise<CommentFileModel> {
    const ymodel = new YDocument<DocumentChange>();
    const path = hashString(sourcePath).toString();
    console.log('path', path);
    const provider = this.docProviderFactory({
      contentType: 'file',
      path,
      ymodel
    });

    const lock = await provider.acquireLock();
    const isInitialized = await provider.requestInitialContent();
    let promise;
    if (isInitialized) {
      console.log('isInitialized = true; saving to disk');
      promise = this._save(path, ymodel);
    } else {
      console.log('isInitialized = false; loading from disk');
      promise = this._load(path, ymodel);
    }

    const releaseLock = () => provider.releaseLock(lock);

    promise
      .then(() => {
        console.log('put initialized state');
        provider.putInitializedState();
      })
      .then(releaseLock, releaseLock);

    const awareness = ymodel.awareness;

    const model = new CommentFileModel({
      registry: this.registry,
      ydoc: ymodel,
      sourcePath,
      awareness,
      path
    });

    return model;
  }

  async _load(path: string, ymodel: YDocument<DocumentChange>): Promise<void> {
    return this.manager.get(path).then(model => {
      console.log('_load model:', model);
      if (model != null) {
        const comments = ymodel.ydoc.getArray('comments');
        ymodel.transact(() => {
          comments.delete(0, comments.length);
          comments.push(model.content as IComment[]);
        });
      }
    });
  }

  async _save(path: string, ymodel: YDocument<DocumentChange>): Promise<any> {
    return this.manager.save(path, {
      type: 'file',
      format: 'text',
      content: JSON.stringify(ymodel.ydoc.getArray('comments').toJSON())
    });
  }

  readonly manager: ContentsManager;
  readonly docProviderFactory: IDocumentProviderFactory;
  readonly registry: ICommentRegistry;
}

export namespace CommentModelFactory {
  export interface IOptions {
    manager: ContentsManager;
    docProviderFactory: IDocumentProviderFactory;
    registry: ICommentRegistry;
  }
}
