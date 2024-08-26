import { Component, OnDestroy, OnInit } from '@angular/core';
import { HeroRepositoryService } from '../hero-repository.service';
import { filter, map, Observable, Subject, takeUntil, tap } from 'rxjs';
import { Hero, Planet } from '../model';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PlanetRepositoryService } from '../planet-repository.service';

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
