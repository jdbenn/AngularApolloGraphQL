import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, take, takeUntil } from 'rxjs';
import { Planet } from '../model';
import { PlanetRepositoryService } from '../planet-repository.service';
import { CommonModule } from '@angular/common';

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
      take(1),
      takeUntil(this.destroy$)
    )
    .subscribe()
  }
}
