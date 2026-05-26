import { Client, Account, Databases } from 'appwrite';

const client = new Client();

client
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);

export const APPWRITE_CONFIG = {
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    routinesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_ROUTINES_COLLECTION_ID!,
    workoutsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_WORKOUTS_COLLECTION_ID!,
    setsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_SETS_COLLECTION_ID!,
};
