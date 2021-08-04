import { Awareness } from 'y-protocols/awareness';
import { IIdentity } from './commentformat';
import { getAnonymousUserName, getRandomColor } from '@jupyterlab/docprovider';
import { UserIcons } from './icons';

export const emptyIdentity: IIdentity = {
  id: 0,
  icon: 0,
  name: 'User',
  color: ''
};

let count = -1;
export function randomIdentity(): IIdentity {
  return {
    id: count--,
    name: getAnonymousUserName(),
    color: getRandomColor(),
    icon: Math.floor(Math.random() * UserIcons.length)
  };
}

export function setIdentityName(awareness: Awareness, name: string): boolean {
  let localState = awareness.getLocalState();
  if (localState == null) {
    return false;
  }
  const oldUser = localState['user'];
  if (oldUser == null) {
    return false;
  }
  let newUser = {
    name: name,
    color: oldUser['color'],
    icon: oldUser['icon'] ?? Math.floor(Math.random() * UserIcons.length)
  };
  awareness.setLocalStateField('user', newUser);

  //Checking if the localState has been updated
  localState = awareness.getLocalState();
  if (localState == null) {
    return false;
  }
  if (localState['user']['name'] != name) {
    return false;
  }
  return true;
}

export function getIdentity(awareness: Awareness): IIdentity {
  const localState = awareness.getLocalState();
  if (localState == null) {
    return emptyIdentity;
  }

  const userInfo = localState['user'];
  if (userInfo != null && 'name' in userInfo && 'color' in userInfo) {
    return {
      id: awareness.clientID,
      name: userInfo['name'],
      color: userInfo['color'],
      icon: Math.floor(Math.random() * UserIcons.length)
    };
  }

  return randomIdentity();
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

//function that converts a line-column pairing to an index
export function lineToIndex(str: string, line: number, col: number): number {
  if (line == 0) {
    return col;
  } else {
    let arr = str.split('\n');
    return arr.slice(0, line).join('\n').length + col + 1;
  }
}

export function hashString(s: string): number {
  let hash = 0;
  if (s.length == 0) {
    return hash;
  }
  for (let i = 0; i < s.length; i++) {
    let char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
