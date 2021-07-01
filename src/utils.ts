import { Awareness } from 'y-protocols/awareness';
import { IIdentity } from './commentformat';

export const emptyIdentity: IIdentity = {
  id: 0,
  name: '',
  color: ''
};

export function getIdentity(awareness: Awareness): IIdentity {
  const localState = awareness.getLocalState();
  if (localState == null) {
    return emptyIdentity;
  }

  const userInfo = localState['user'];
  if ('name' in userInfo && 'color' in userInfo) {
    return {
      id: awareness.clientID,
      name: userInfo['name'],
      color: userInfo['color']
    };
  }

  return emptyIdentity;
}

export function getCommentTimeString(): string {
  const d = new Date();
  const time = d.toLocaleString('default', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
  const date = d.toLocaleString('default', {
    month: 'short',
    day: 'numeric'
  });
  return time + ' ' + date;
}
