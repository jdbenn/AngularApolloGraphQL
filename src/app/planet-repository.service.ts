import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Planet } from './model';

@Injectable({
  providedIn: 'root'
})
export class PlanetRepositoryService {

  constructor(private httpClient: HttpClient) { }

  getAllPlanets() : Observable<Planet[]> {
    return this.httpClient.get<Planet[]>('someurl');
  }
}
