import { Injectable } from '@angular/core';
import { filter, map, Observable, tap } from 'rxjs';
import { Planet } from './model';
import { gql, Apollo, MutationResult } from 'apollo-angular'

@Injectable({
  providedIn: 'root'
})
export class PlanetRepositoryService {

  constructor(private apollo:Apollo) { }

  getAllPlanets() : Observable<Planet[]> {
    return this.apollo.watchQuery({
      query: GET_ALL_PLANETS
    }).valueChanges.pipe(
      filter((response) => response.data != null),
      map((response) => response.data as Planet[])
    )
  }

  addPlanet(planet:Planet): Observable<Planet> {
    return this.apollo
      .mutate<Planet>({
        mutation: ADD_PLANET,
        variables: { planet },
        refetchQueries: [
          GET_ALL_PLANETS
        ]
      }).pipe(
        filter((result:MutationResult<Planet>) => result.data != null),
        map((result: MutationResult<Planet>) => result.data as Planet)
      )
  }
  
}

const GET_ALL_PLANETS = gql`
    planets() {
      name
      avgTemp
      habitable
    }
  `

const ADD_PLANET = gql`
  mutation ($planet:Plant) {
    addPlanet(planet: $planet) {
      name
      avgTemp
      habitable
    }
  }
`