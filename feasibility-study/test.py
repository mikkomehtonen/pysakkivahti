import requests
import time
import os
import sys

api_key = os.getenv('PYSAKKIVAHTI_API_KEY')
if (api_key == None):
  print("No API-KEY")
  sys.exit()

query = """
{
  stop(id: "tampere:0851") {
    name
    stoptimesWithoutPatterns(numberOfDepartures: 10) {
      scheduledDeparture
      realtimeDeparture
      realtime
      serviceDay
      headsign
      trip {
        route {
          shortName
          longName
          mode
        }
      }
    }
  }
}
"""

response = requests.post(
    "https://api.digitransit.fi/routing/v2/waltti/gtfs/v1",
    json={"query": query},
    headers={
        "digitransit-subscription-key": api_key
    }
)

print(response.json())
data = response.json()["data"]["stop"]

now = int(time.time())

for st in data["stoptimesWithoutPatterns"]:
    departure_epoch = st["serviceDay"] + st["realtimeDeparture"]
    minutes = round((departure_epoch - now) / 60)

    route = st["trip"]["route"]["shortName"]
    headsign = st["headsign"]

    print(f"{route} {headsign}: {minutes} min")