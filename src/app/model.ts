export interface Hero {
    name: string
    type: 'Good Guy' | 'Bad Guy'
    planet: Planet
    allies: Hero[] | null
}

export interface Planet {
    name: string;
    climate: string;
}