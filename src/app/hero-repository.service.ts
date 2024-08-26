import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { Hero } from './model';
import { Apollo, gql } from 'apollo-angular'

@Injectable({
  providedIn: 'root'
})
export class HeroRepositoryService {

  private readonly endpoint = 'https://somefictiousendpoint.com/heros';

  constructor(private httpClient: HttpClient, private apollo: Apollo ) { }

  public getHero(name:string) : Observable<Hero> | null {
    return this.httpClient.get<Hero>(`${this.endpoint}/${name}`);
  }

  public getHerosByType(heroType:string): Observable<Hero[]> | null {
    return this.apollo.watchQuery({
      query: GET_HEROS_BY_CATEGORY,
      variables: {
        heroType: heroType,
      },
    }).valueChanges
      .pipe(
        filter((result) => result.data !== null),
        map((result) => result.data as Hero[])
      )
  }


}

const GET_HEROS_BY_CATEGORY = gql`
    herosByHeroType(heroType:String) {
      name
      heroType
    }
  `