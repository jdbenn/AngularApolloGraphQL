# Angular Subscription Management with GraphQL APIs





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

The Apollow library does a lot for clients.  It has built in caching and automtic re-fetching during mutations to keep front end applications fast and in sync with backend.  

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

So we use the Angular lifecycle hook onInit to manually subscribe and set the backing variable.  

The most important part here is introduction of a instance Subject to the component.  A subject is special kind of observable in that it is **WRITABLE**.  In our planets subscrption we will take all emitted values until _this_ (the component) is destroyed. 

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

### Installation

First, install the necessary packages:

```bash
npm install @apollo/client @apollo/angular graphql
```

Then, configure the Apollo client in your Angular application. You’ll need to set up an Apollo module with the AWS AppSync endpoint.

### Apollo Client Configuration

Create a file `app.module.ts` and configure the Apollo client:

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpLinkModule, HttpLink } from 'apollo-angular-link-http';
import { InMemoryCache } from '@apollo/client/core';
import { ApolloModule, Apollo } from 'apollo-angular';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    ApolloModule,
    HttpLinkModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(private apollo: Apollo, private httpLink: HttpLink) {
    const uri = environment.appSyncUrl; // Your AppSync endpoint
    const link = httpLink.create({ uri });

    this.apollo.create({
      link,
      cache: new InMemoryCache()
    });
  }
}
```

Ensure `environment.appSyncUrl` contains your AWS AppSync GraphQL endpoint.

## Best Practices for Subscribing to Observables

When working with observables, especially with subscriptions, it's crucial to follow best practices to ensure performance and maintainability.

### 1. **Use the Async Pipe for Template Subscriptions**

The `async` pipe is one of the most effective tools for managing observable subscriptions in Angular templates. It automatically subscribes to the observable and updates the view with the latest data. It also handles unsubscription when the component is destroyed, thus preventing memory leaks.

Example:

```html
<div *ngIf="data$ | async as data">
  <p>{{ data.someField }}</p>
</div>
```

In this example, `data$` is an observable that emits data. The `async` pipe subscribes to `data$` and handles unsubscription automatically.

### 2. **Manual Subscription Management**

While the `async` pipe is convenient, there are scenarios where manual subscription is necessary, especially when you need to perform side effects or handle complex logic.

Example:

```typescript
import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

const SUBSCRIBE_TO_DATA = gql`
  subscription OnDataChanged {
    dataChanged {
      id
      value
    }
  }
`;

@Component({
  selector: 'app-data',
  templateUrl: './data.component.html'
})
export class DataComponent implements OnDestroy {
  private subscription: Subscription;
  public data: any;

  constructor(private apollo: Apollo) {
    this.subscription = this.apollo.subscribe({
      query: SUBSCRIBE_TO_DATA
    }).subscribe(result => {
      this.data = result.data;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
```

In this example, we manually subscribe to the `SUBSCRIBE_TO_DATA` GraphQL subscription and handle data updates. We also unsubscribe in `ngOnDestroy` to avoid memory leaks.

### 3. **Avoid Memory Leaks**

Memory leaks can occur if subscriptions are not properly managed. When manually subscribing, always ensure that you unsubscribe in the component’s `ngOnDestroy` lifecycle hook. This practice prevents the subscription from continuing after the component is destroyed.

### 4. **Debounce and Throttle Subscriptions**

In scenarios where subscriptions emit frequently, consider debouncing or throttling to manage performance. This helps to avoid unnecessary rendering or processing.

Example:

```typescript
import { debounceTime } from 'rxjs/operators';

// Inside your subscription
this.apollo.subscribe({
  query: SUBSCRIBE_TO_DATA
}).pipe(
  debounceTime(300) // Adjust the time as needed
).subscribe(result => {
  this.data = result.data;
});
```

### 5. **Use Refetch Queries to Update Data**

When using mutations that affect the data displayed in your application, use refetch queries to update the data after a mutation. This ensures that your data stays consistent with the backend.

Example:

```typescript
import { Component } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { BehaviorSubject } from 'rxjs';

const MUTATE_DATA = gql`
  mutation UpdateData($id: ID!, $value: String!) {
    updateData(id: $id, value: $value) {
      id
      value
    }
  }
`;

const REFETCH_DATA = gql`
  query GetData {
    data {
      id
      value
    }
  }
`;

@Component({
  selector: 'app-update-data',
  templateUrl: './update-data.component.html'
})
export class UpdateDataComponent {
  private refetchSubject = new BehaviorSubject<void>(undefined);

  constructor(private apollo: Apollo) {}

  updateData(id: string, value: string) {
    this.apollo.mutate({
      mutation: MUTATE_DATA,
      variables: { id, value },
      refetchQueries: [{ query: REFETCH_DATA }]
    }).subscribe({
      next: (result) => console.log('Mutation successful', result),
      error: (error) => console.error('Error during mutation', error)
    });
  }
}
```

In this example, after performing a mutation, the `refetchQueries` option ensures that the `GetData` query is executed again to refresh the data.

### 6. **Error Handling**

Always implement error handling in your subscriptions to gracefully handle failures.

Example:

```typescript
this.apollo.subscribe({
  query: SUBSCRIBE_TO_DATA
}).subscribe({
  next: (result) => {
    this.data = result.data;
  },
  error: (error) => {
    console.error('Subscription error', error);
    // Handle error appropriately
  }
});
```

## Performance Considerations

### **1. Efficient Querying**

Ensure that your GraphQL queries and subscriptions are optimized to reduce the load on your server and client. Fetch only the data you need and avoid excessively large payloads.

### **2. Optimize Rendering**

When working with frequently updating data, consider using change detection strategies to optimize rendering. Angular’s `OnPush` change detection strategy can be particularly effective in scenarios with large datasets or frequent updates.

Example:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-optimized-data',
  templateUrl: './optimized-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedDataComponent {
  // Your component logic
}
```

### **3. Caching**

Leverage caching mechanisms provided by Apollo Client to reduce the number of requests sent to the server. This can improve performance and reduce costs.

```typescript
import { InMemoryCache } from '@apollo/client/core';

this.apollo.create({
  link,
  cache: new InMemoryCache()
});
```

## Conclusion

Subscribing to observables in Angular, particularly with GraphQL using AWS AppSync and Apollo, involves understanding both Angular’s reactive programming model and efficient data management practices. By using the `async` pipe for template subscriptions, managing manual subscriptions carefully, and leveraging Apollo’s features like refetching and caching, you can ensure that your application remains performant and maintainable.

Remember to always handle errors gracefully, avoid memory leaks by unsubscribing from observables, and optimize both your queries and rendering strategies. With these best practices, you’ll be well-equipped to build responsive, real-time applications with Angular and GraphQL.

Happy coding!#   A n g u l a r A p o l l o G r a p h Q L  
 