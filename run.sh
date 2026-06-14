docker run -d -p 3107:3000 \
  --restart unless-stopped \
  --name pysakkivahti \
  --env-file /data/pysakkivahti/.env \
  pysakkivahti
