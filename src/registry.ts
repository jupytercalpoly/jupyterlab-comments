import { CommentFactory } from './factory';

export interface ICommentRegistry {
  createFactory: <T>(options: CommentFactory.IOptions<T>) => CommentFactory<T>;
  getFactory: (id: string) => CommentFactory<any> | undefined;

  readonly factories: Map<string, CommentFactory<any>>;
}

/**
 * A class that manages a map of `CommentFactory`s
 */
export class CommentRegistry implements ICommentRegistry {
  createFactory<T>(options: CommentFactory.IOptions<T>): CommentFactory<T> {
    const factory = new CommentFactory<T>(options);
    this.factories.set(options.type, factory);
    return factory;
  }

  getFactory(type: string): CommentFactory<any> | undefined {
    let factory: CommentFactory<any> | undefined;

    if (type === '') {
      console.warn('empty factory type is not allowed');
      return;
    } else if (this._t1 === type) {
      factory = this._f1;
    } else if (this._t2 === type) {
      factory = this._f2;
      [this._f2, this._f1] = [this._f1, this._f2];
      [this._t2, this._t1] = [this._t1, this._t2];
    } else {
      factory = this.factories.get(type);
      [this._f2, this._t2] = [this._f1, this._t1];
      [this._f1, this._t1] = [factory, type];
    }

    if (factory == null) {
      console.warn('no factory found for comment with type', type);
      return;
    }

    return factory;
  }

  private _t1: string = '';
  private _t2: string = '';
  private _f1: CommentFactory<any> | undefined;
  private _f2: CommentFactory<any> | undefined;
  readonly factories = new Map<string, CommentFactory<any>>();
}
