import { ACommentFactory } from './factory';

export interface ICommentRegistry {
  getFactory: (id: string) => ACommentFactory | undefined;
  addFactory: (factory: ACommentFactory) => void;

  readonly factories: Map<string, ACommentFactory>;
}

/**
 * A class that manages a map of `CommentFactory`s
 */
export class CommentRegistry implements ICommentRegistry {
  addFactory(factory: ACommentFactory): void {
    this.factories.set(factory.type, factory);
  }

  getFactory(type: string): ACommentFactory<any> | undefined {
    let factory: ACommentFactory<any> | undefined;

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
  private _f1: ACommentFactory<any> | undefined;
  private _f2: ACommentFactory<any> | undefined;
  readonly factories = new Map<string, ACommentFactory>();
}
