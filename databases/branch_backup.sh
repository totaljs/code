#!/bin/sh

tar -cvf $1 $2 --exclude=/logs/debug.log
tar --append --file $1 $3
tar --append --file $1 $4