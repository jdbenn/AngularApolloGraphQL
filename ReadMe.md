# Angular Subscription Management with GraphQL APIs

I recently found myself working on an account using a technology stack you don't often find together (at least it is not as popular).  This client is building an application using Angular with a dotnet backend that uses Hot Chocolate to expose a GraphQL api.  

GraphQL is really popular.  Especially amount the React community.  More often than not Angular will connect with simple REST APIs (event OData).  There is support for GraphQL and Angular through an open source project called Apollo.  

Working on this project, I noticed few things that could turn into problems in the form of memory leaks and performance in general because of some nuanced differences in the library used to integrate with the GraphQL endpoint and a traditional HttpClient implementation.  

## Background

Some background on the technology involved to level set the audience.  

### GraphQL

[GraphQL](https://graphql.org/) was originally developed by our friends over at Meta back in 2012.  Open sourced in 2015, GraphQL is all about exposing flexibility to consuming clients by allowing clients to ask for exactly what they need by exposing all of an api through a single endpoint.  GraphQL define types - not endpoints.  

Another important feature of GraphQL is the support of connected clients via websockets and subscriptions.  In other words - live updates to clients via push.  

Take for example the following types defined below:

```graphql
  type Query {
    hero: Character
    herosByHeroType(heroType:String): [Character]
  }
  
  type Character {
    name: String
    friends: [Character]
    homeWorld: Planet
    species: Species
  }
  
  type Planet {
    name: String
    climate: String
  }
  
  type Species {
    name: String
    lifespan: Int
    origin: Planet
  }
```

A consuming client would post a query to the server with a payload looking something like this:

```graphql
  {
    hero {
      name
      homeWorld {
        name
      }
      friends {
        name
      }
      species {
        name
      }
    }
  }
```

and our response looks like:

```json
  {
    "hero": {
      "name": "Anikan Skywalker",
      "homeWorld": {
        "name": "Tatooine"
      },
      "friends": [
        {
          "name": "Obi Wan Kenobe"
        }
      ],
      "species": {
        "name": "Human"
      }
    }
  }
```

### Angular

_[Angular](https://angular.dev/) is a web framework that empowers developers to build fast, reliable applications.  Maintained by a dedicated team at Google, Angular provides a broad suite of tools, APIs, and libraries to simplify and streamline your development workflow._

Considerably different than React - the crew at Google took a VERY opinionated opinion on how to build applications.  Angular is considered "harder" to learn - but once that learning curve is achieved - considered more performant.  

Angular makes heavy use of [RXJS](https://rxjs.dev/) in what is referred to as a reactive programming model.  The concept is the app views and state react to changes in data that are consumed through an "observable" stream.  

This is contrary to a typical request / response paradigm where the app requests data then applies an effect (React style) to update the view.  

An observable must be "subscribed" to in order to receive data.  This is pub / sub within the app.  The observable stream publishes to many subscriptions. 

As an example lets define a repository service that will call a backend api and return a specific hero:  

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Hero } from './model';

@Injectable({
  providedIn: 'root'
})
export class HeroRepositoryService {

  private readonly endpoint = 'https://somefictiousendpoint.com/heros';

  constructor(private httpClient: HttpClient) { }

  public getHero(name:string) : Observable<Hero> | null {
    return this.httpClient.get<Hero>(`${this.endpoint}/${name}`);
  }
}

```

In order to actually fetch data and show it on the view - we have to subscribed to it.  

Here is the component class that will be used to display the data:

```ts

@Component({
  selector: 'app-hero-detail',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './hero-detail.component.html',
  styleUrl: './hero-detail.component.scss'
})
export class HeroDetailComponent implements OnInit {

  protected heroId$: Observable<string> | null = null;
  protected hero: Hero | null = null;

  constructor(
    private route: ActivatedRoute,
    private heroRepository: HeroRepositoryService){

  }
  ngOnInit(): void {
    this.heroId$ = this.route.params
      .pipe(
        filter((param) => param['id'] !== null),
        map((param) => param['id']),
        tap((heroId) => this.hero$ = this.heroRepository.getHero(heroId))
      )
  }
}

```

We have 2 instance variables defined (hero$ and heroId$) defined.  We access this component by going to /heros/{{heroId}} in our url.  From there we can extract the id from the route 

```ts
...
    this.heroId$ = this.route.params
      .pipe(
        filter((param) => param['id'] !== null),
        map((param) => param['id']),
```

And now that we have the hero Id extracted from the url, we can assign the observable to the hero$ instance of the component.  

```ts
tap((heroId) => this.hero$ = this.heroRepository.getHero(heroId))
```

It is important to note we still have not **Subscribed** to the stream.  All we have done is assign obsevable streams to backing variables.  There are 2 ways to subscribe to streams; one of them is known as the _async_ pipe.  

Our template file has a simple mark-up that will display the hero name WHEN both heroId$ and hero$ observables emit values.  The _async_ pipe is a special feature in Angular that will 1. subscribe to the observable and 2. most importantly **UNSUBSCRIBE** when the component is destroyed.  

It is this subscription management that will be the bulk of this article.  

```ts
@if((heroId$ | async) && (hero$ | async); as hero) {

    <p>{{hero.name}} </p>
}
```

### Apollo Client

The app will use a library called [Apollo](https://the-guild.dev/graphql/apollo-angular/docs).  The library is used to interact with GraphQL APIs.  

The Apollo library does a lot for clients.  It has built in caching and automtic re-fetching during mutations to keep front end applications fast and in sync with backend.  

Recall what a query to a GraphQL API looks like from above.  Using the Apollo library, it looks something like this:

```ts
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

.....

const GET_HEROS_BY_CATEGORY = gql`
    herosByHeroType(heroType:String) {
      name
      heroType
    }
  `
```

## Managing Subscriptions

One of the easiest and most often ways to introduce a memory leak into an angular application is by not managing your subscriptions.  By not managing - I mean ensuring they are unsubscribed and destroyed.  

I have already mentioned Angular provides a mechanism to both subscribe and unsubscribe when the component is initiated and destroyed via the _async_ pipe.  

```html
@if((heroId$ | async) && (hero$ | async); as hero) {

    <p>{{hero.name}} </p>
}
```

If you can handle the subscription with the template - do it this way.  No reason to manage it yourself.  

If only life were that simple.  

Sometimes we cannot use the view template to subscribe to observable streams.  A typical scenario where this comes up is when you have multiple observable streams that need to be subscribed to and re-fetched when another stream emits a new value.

Of course there may be a way to construct a pipe chain so that all observables are still subscribed to by the view - but there are times will you will need to manually handle the subscription.  

In those cases this is typically what we see is something like this:

```ts
@Component({
  selector: 'app-hero-detail',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './hero-detail.component.html',
  styleUrl: './hero-detail.component.scss'
})
export class HeroDetailComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();
  protected heroId$: Observable<string> | null = null;
  protected hero$: Observable<Hero> | null = null;
  private planets: Planet[] | null = null;

  constructor(
    private route: ActivatedRoute,
    private heroRepository: HeroRepositoryService,
    private planetRepository: PlanetRepositoryService,
  ){

  }
  ngOnDestroy(): void {
   this.destroy$.next();
  }

  ngOnInit(): void {
    this.heroId$ = this.route.params
      .pipe(
        filter((param:any) => param['id'] !== null),
        map((param:any) => param['id']),
        tap((heroId:string) => this.hero$ = this.heroRepository.getHero(heroId))
      );

      this.planetRepository.getAllPlanets()
      .pipe(
        takeUntil(this.destroy$),
        tap((planets) => this.planets = planets)
      ).subscribe()
  }
}
```

So now we have a new variable **planets** that is retrieved by the planetRepository.

For whatever reason we couldn't use the view to subscribe to the observable (I'm sure there was a good reason).  

So we use the Angular lifecycle hook onInit to manually subscribe and set the backing planets variable.  

The most important part here is introduction of a instance Subject to the component.  A subject is special kind of observable in that it is **WRITABLE**.  In our planets subscrption we will take all emitted values until _this_ (the component) is destroyed.  The way that notification occurs is by subscribing to the subject:

```ts
    this.planetRepository.getAllPlanets()
      .pipe(
        takeUntil(this.destroy$),
        tap((planets) => this.planets = planets)
    ).subscribe()
```

Using the angular lifecycle hooks again, we call the next method on the subject to so anything subscribing will be unsubscribed.  

```ts
  ngOnDestroy(): void {
   this.destroy$.next();
  }
```

## Angular HttpClient

Taking a step back for a minute, one important note to mention is the observable that is returned from the Angular HttpClient.  This class is a feature offered by Angular that does exactly what it sounds like.

All GETs, POSTS, PUTS, DELETES, etc and the corresponding responses are wrapped in an observable stream that must be subscribed to in order to actually make the calls.  

The difference between the observable returned by the Angular HttpClient and other observable streams is that the HttpClient **AUTOMATICALLY** unusbscribes when the response is received from the server or the request times out.  

From the Angular docs:

_In general, you should unsubscribe from an observable when a component is destroyed.
You don't have to unsubscribe from HttpClient observables because they unsubscribe automatically after the server request responds or times out. Most developers choose not to unsubscribe._

Often than not you will find code that looks like this:

```ts
  onInit() {
    this.hero$ = this.route.params
      .pipe(
        tap((params:any) => {
          this.heroId = params['id'];
          this.heroRepository.getHero(this.heroId))
            .pipe(
              tap((hero:Hero) => this.hero = hero)
            ).subscribe()
          })
      )
  }
```

The 2 subscriptions here will be handled by the view template (hero$), which wil be automatically subscribed and destroyed with the lifecycle of the component.  


```html
@if((heroId$ | async) && (hero$ | async); as hero) {

    <p>{{hero.name}} </p>
}
```

The other subscription to the heroRepository is manual without ever unsubscribing:

```ts
  this.heroRepository.getHero(this.heroId))
    .pipe(
          tap((hero:Hero) => this.hero = hero)
         ).subscribe()
  })
```

This will not cause any harm if we know that the actual class making the calls in the hero repository is the HttpClient.  My opinion would be to handle the subscription anyway for clarity and future proofing.  There is nothing wrong with explicitly handling the subscription (use the _async_ pipe or _takeUntil_).

```ts
  ngOnInit(): void {
    this.heroId$ = this.route.params
      .pipe(
        filter((param:any) => param['id'] !== null),
        map((param:any) => param['id']),
        tap((heroId:string) => this.hero$ = this.heroRepository.getHero(heroId))
      );
  }
```


## Apollo Is Not the Angular HttpClient

The Apollo client observables returned by either a query, mutatation or watch query are **NOT** automatically unsubscribed.  You have to manage the subscriptions.  

The subscription to querys or a watchQuery with Apollo can usually be handled with one of the two approaches previously mentiond.  A typical flow will be to initialize the component, subscribe to an Apollo query and render the template once the data is emitted to the observable.  

Generally speaking the data is not going to change again (unless it was a websocket connection) and the subscription will stay alive with the component.  

Using the planet repository example, let's assume we had a simple list view that showed all of the planets we have saved in the backend. 

![Planet List](/assets/PlanetList.png)

In order to get data on this view we use the [PlanetRepository](./src/app/planet-repository.service.ts).

```ts
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
  
}
```
The repository is injected into the [PlanetComponent](/src/app/planet//planet.component.ts) and the subscription handled by the view as we have done previously.


```ts
@Component({
  selector: 'app-planet',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './planet.component.html',
  styleUrl: './planet.component.scss'
})
export class PlanetComponent implements OnInit {

    protected planets$: Observable<Planet[]> | null = null;

    constructor(private planetRepository: PlanetRepositoryService) {

    }
  ngOnInit(): void {
    throw new Error('Method not implemented.');
  }
}
```

```html
@if((planets$ | async); as planets) {
    <table>
        <th>Name</th>
        <th>Avg Temp</th>
        <th>Habitable</th>

        @for (planet of planets; track $index) {
            <tr>
                <td>{{planet.name}}</td>
                <td>{{planet.avgTemp}}</td>
                <td>{{planet.habitable}}</td>
            </tr>
        }
    </table>
}
```

We also have the ability to add a planet and this is where 1. the cool stuff of Apollo really shine and 2. one needs to be aware of subscription management.  

### Apollo Mutations

Apollo mutations also return an observable that needs to be subscribed to in order to make api call and receive data.  

An implementation of adding a planet via the [PlanetRepository](/src/app/planet-repository.service.ts):

```ts
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
  ```

If you are not famailar with GraphQL - a mutation is the CUD of CRUD - adds, saves and deletes.  

This method looks pretty straight forward, specify the mutation, include variables and return the response.  

What makes Apollo slick is the local caching.  When the component was first loaded up, the getAllPlanets was subscribed to in the view template.  This resulted in the data being cached by the Apollo client.  

With the mutation - we are creating a difference between what is on the server and what we have locally - so the local cache needs to be updated.

That is what the refetchQueries will do for us; making an api call and publishing new values to the observable stream the component is already subscribed to.  

```ts
@Component({
  selector: 'app-planet',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './planet.component.html',
  styleUrl: './planet.component.scss'
})
export class PlanetComponent implements OnInit {

    protected planets$: Observable<Planet[]> | null = null;

    constructor(private planetRepository: PlanetRepositoryService) {

    }
  ngOnInit(): void {
    this.planets$ = this.planetRepository.getAllPlanets();
  }

  addPlanet() {
    const planet: Planet = {
      name: 'Earth',
      avgTemp: '65',
      habitable: 'yes'
    }
    this.planetRepository.addPlanet(planet).subscribe()
  }
}
```

Apollo will call _GET_ALL_PLANETS_ after the mutation is complete, the _planets$_ observable will receive new values and the view template will be updated with the new planet.  All without us having manage that.

There is a problem though.  Subscription resulting from the "addPlanet" on the Planet Repository. 

```ts
  addPlanet() {
    const planet: Planet = {
      name: 'Earth',
      avgTemp: '65',
      habitable: 'yes'
    }
    this.planetRepository.addPlanet(planet).subscribe()
  }
  ```

  So the problem here is we can't use an _async_ pipe to subscribe and unsubscribe.  

  Using a subject with the _takeUntil_ pipe also has faults.

  Let's refactor the [PlanetComponent](./src/app/planet//planet.component.ts) to include a subject that we can leverage for ensuring subscriptions are destroyed.


```ts

@Component({
  selector: 'app-planet',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './planet.component.html',
  styleUrl: './planet.component.scss'
})
export class PlanetComponent implements OnInit, OnDestroy {

    private readonly destroy$ = new Subject<void>();

    protected planets$: Observable<Planet[]> | null = null;

    constructor(private planetRepository: PlanetRepositoryService) {

    }
  ngOnDestroy(): void {
    this.destroy$.next();
  }
  ngOnInit(): void {
    this.planets$ = this.planetRepository.getAllPlanets();
  }

  addPlanet() {
    const planet: Planet = {
      name: 'Earth',
      avgTemp: '65',
      habitable: 'yes'
    }
    this.planetRepository.addPlanet(planet)
    .pipe(
      takeUntil(this.destroy$)
    )
    .subscribe()
  }
}
```

This is better - but still could result in multiple subscriptions.  If you click the add button more than once and never navigate away where the component will be destroyed - each click will result in a subscription.

Recall the subscription **ALSO** includes a refetch.  Add 10 planets - the refetch will get called 10 times for each subscription.  

At least the subscriptions will be cleaned  up when the component is destroyed - keeping the memory leak from just building and building (consider leaving the app running for hours and navigating back and forth to this view).

One more additional step we can take is using the _take_ operator _in addtion to_ the _takeUntil_ operator.  

Refactoring one more time:

```ts
  addPlanet() {
    const planet: Planet = {
      name: 'Earth',
      avgTemp: '65',
      habitable: 'yes'
    }
    this.planetRepository.addPlanet(planet)
    .pipe(
      take(1),
      takeUntil(this.destroy$)
    )
    .subscribe()
  }
```

So now we are going to subscribe for only one emitted value.  The reason I leave the _takeUntil_ in place is a safety net.  

Imagine a long running api call - mutation.  The server takes 20 seconds to respond and the user get's impatient and navigates away.

This means the value would never have been emitted into the observable - our _take_ operator would never execute.  The subscription remains.

Using both of these (and the order matters in the pipe operators) - we can safely subscribe to Apollo mutations that require multiple subscriptions while the component is instantiated. 

# Conclusion

GraphQL APIs are very popular.  All the cloud vendors have some form of GraphQL service (AWS arguably being the easiest to deploy with AppSync).  While it is true the React is certainly more popular to use with GraphQL - there are use cases where Angular is used.  

The Apollo client offers an excellent tool to help that integration.  You just need to be aware of a few of the important aspects when it comes to managing subscriptions.  