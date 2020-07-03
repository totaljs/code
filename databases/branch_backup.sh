#!/bin/sh

echo "$2/logs/debug.log"

tar --exclude="$2logs" -cvf $1 $2

if [ -f "$3" ]; then
	tar --append --file $1 $3
fi

if [ -f "$4" ]; then
	tar --append --file $1 $4
fi