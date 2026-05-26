const { Client, Databases, Query } = require('node-appwrite');

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('679f79c700304a544f61')
    .setKey('standard_4a21243838a18f8085eeec64e5274a3aaf022ba80502016cc2a5b108233b112c082d66f84fec518e3984d606423694d3a3837a0c12fe275fec6264f09b832f5fab2ee7895ded1282053a933116aa182c9518dbece9c18fffa0bd8b01adb7c97394ec19341cd13be1cfe45afee65a8857d7f85bc7da182af02f0b598084f4fb07');

const databases = new Databases(client);

async function checkHistory() {
    try {
        console.log("Checking workouts...");
        const workoutsRes = await databases.listDocuments(
          'overload_db',
          'workouts',
          // Try without userId first to see if any workouts exist
          [Query.orderDesc("$createdAt")]
        );
        console.log("Total workouts in DB:", workoutsRes.total);
        if (workoutsRes.total > 0) {
            console.log("Latest workout:", workoutsRes.documents[0]);
        }
        
        console.log("\nChecking sets...");
        const setsRes = await databases.listDocuments(
          'overload_db',
          'sets',
          [Query.orderDesc("$createdAt"), Query.limit(1)]
        );
        console.log("Total sets in DB:", setsRes.total);
        if (setsRes.total > 0) {
            console.log("Latest set:", setsRes.documents[0]);
        }
    } catch(e) { 
        console.error("ERROR:", e);
    }
}
checkHistory();
