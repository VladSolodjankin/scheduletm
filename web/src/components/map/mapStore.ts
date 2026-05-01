import { makeAutoObservable } from 'mobx';

export type MapCoordinates = {
  lat: number;
  lng: number;
};

export class MapStore {
  center: MapCoordinates;

  constructor(initialCenter: MapCoordinates) {
    this.center = initialCenter;
    makeAutoObservable(this);
  }

  setCenter(center: MapCoordinates) {
    this.center = center;
  }
}
