export type Branded<Base, Name extends string> = Base & {__brand?: Name};
export type RequireKeys<Base, K extends keyof Base> = Omit<Base, K> & Required<Pick<Base, K>>;
export function hasKey<O extends object>(obj: O, key: string | number | symbol): key is keyof O {
    return key in obj;
}
type SerializablePrimitive = { toString(): string };
export type QuerySerializable = { [key: string]: SerializablePrimitive | SerializablePrimitive[] | QuerySerializable };
