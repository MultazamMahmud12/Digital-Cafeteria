#!/bin/bash

# Wait for MongoDB to be ready
sleep 5

# Initialize replica set
mongosh --eval "
try {
  rs.status()
} catch(err) {
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'localhost:27017' }]
  })
}
"
