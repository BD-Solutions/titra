import Extensions from '../extensions'

Meteor.publish('extensions', () => Extensions.find({}, {
  fields: {
    name: 1, description: 1, version: 1, state: 1, isActive: 1, client: 1,
  },
}))
