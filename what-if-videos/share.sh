#!/bin/sh
# Make the 1080p copy to post (two-pass, ~3 Mbit/s, about 30 MB for 75 s) from output/<id>.mp4.
# usage: sh share.sh <id> [seconds]   (seconds: cut the master there, with a short audio fade)
set -e
cd "$(dirname "$0")"
id=$1; T=${2:-}
[ -n "$id" ] || { echo "usage: sh share.sh <id> [seconds]"; exit 1; }
cut=""; af=""
if [ -n "$T" ]; then cut="-t $T"; af="-af afade=t=out:st=$(echo "$T - 0.8" | bc):d=0.8"; fi
log=$(mktemp -d)/pass
ffmpeg -v error -y -i output/$id.mp4 $cut -c:v libx264 -preset slow -b:v 3000k -maxrate 4500k -bufsize 9000k -pass 1 -passlogfile $log -an -f mp4 /dev/null
ffmpeg -v error -y -i output/$id.mp4 $cut -c:v libx264 -preset slow -b:v 3000k -maxrate 4500k -bufsize 9000k -pass 2 -passlogfile $log -pix_fmt yuv420p $af -c:a aac -b:a 192k -movflags +faststart output/share/$id-1080p.mp4
ls -la output/share/$id-1080p.mp4
