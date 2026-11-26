import { ValidatedMethod } from 'meteor/mdg:validated-method'
import Tasks from './tasks.js'
import { checkAuthentication, canAccessProject, checkProjectAccess } from '../../utils/server_method_helpers.js'

function checkTaskAccess(taskId, userId) {
  const task = Tasks.findOne({ _id: taskId })
  if (!task || !(task.userId === userId
    || (task.projectId && canAccessProject(task.projectId, userId)))) {
    throw new Meteor.Error('notifications.auth_error_method')
  }
}

const insertProjectTask = new ValidatedMethod({
  name: 'insertProjectTask',
  validate(args) {
    check(args, {
      projectId: String,
      name: String,
      start: Date,
      end: Date,
      dependencies: Match.Optional([String]),
    })
  },
  run({
    projectId, name, start, end, dependencies,
  }) {
    checkAuthentication(this)
    checkProjectAccess(projectId, this.userId)
    Tasks.insert({
      projectId,
      name,
      start,
      end,
      dependencies,
    })
  },
})
const updateTask = new ValidatedMethod({
  name: 'updateTask',
  validate(args) {
    check(args, {
      taskId: String,
      projectId: Match.Optional(String),
      name: Match.Optional(String),
      start: Match.Optional(Date),
      end: Match.Optional(Date),
      dependencies: Match.Optional([String]),
    })
  },
  run({
    taskId, name, start, end, dependencies,
  }) {
    checkAuthentication(this)
    checkTaskAccess(taskId, this.userId)
    const updatedTask = {
    }
    if (name) updatedTask.name = name
    if (start) updatedTask.start = start
    if (end) updatedTask.end = end
    if (dependencies) updatedTask.dependencies = dependencies
    if (updatedTask) {
      Tasks.update(taskId, {
        $set: {
          name,
          start,
          end,
          dependencies,
        },
      })
    }
  },
})
const removeProjectTask = new ValidatedMethod({
  name: 'removeProjectTask',
  validate(args) {
    check(args, {
      taskId: String,
    })
  },
  run({ taskId }) {
    checkAuthentication(this)
    checkTaskAccess(taskId, this.userId)
    Tasks.remove({ _id: taskId })
  },
})
export { insertProjectTask, updateTask, removeProjectTask }
