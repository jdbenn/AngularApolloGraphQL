export interface Hero {
    name: string
    type: 'Good Guy' | 'Bad Guy'
    planet: Planet
    allies: Hero[] | null
}

export interface Planet {
    name: string;
    avgTemp: string;
    habitable: string;
}