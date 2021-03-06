import {AddTodolistActionType, RemoveTodolistActionType, SetTodolistsActionType} from './to-do-list-reducer';
import {TaskStatuses, TaskType, todolistAPI, TodoTaskPriorities, UpdateTaskModelType} from '../../api/todolist-api';
import {Dispatch} from 'redux';
import {AppRootStateType} from '../../app/store';
import {RequestStatusType, setAppErrorAC, setAppStatusAC} from '../../app/app-reducer';
import {handleServerAppError, handleServerNetworkError} from '../../utils/error-utils';

//reducer принимает state & action возвращает newState
//action содержит необходимые превращения и нужные для него данные
//creator для вызова action
let initialState: TaskStateType = {
    count: [],
}

export const tasksReducer = (state: TaskStateType = initialState, action: ActionsType): TaskStateType => {
    switch (action.type) {
        case 'SET-TASKS':
            return {...state, [action.todolistId]: action.tasks}
        case 'SET-TODOLISTS': {
            const stateCopy = {...state}
            action.todolists.forEach((tl) => {
                stateCopy[tl.id] = []
            })
            return stateCopy;
        }
        case 'REMOVE-TASK':
            return {...state, [action.todoListId]: state[action.todoListId].filter(t => t.id !== action.taskId)}
        case 'ADD-TASK':
            return {...state, [action.task.todoListId]: [action.task, ...state[action.task.todoListId]]}
        case 'UPDATE-TASK':
            return {
                ...state,
                [action.todoListId]: state[action.todoListId]
                    .map(t => t.id === action.taskId ? {...t, ...action.model} : t)
            }
        case 'CHANGE-TASK-ENTITY-STATUS':
            return {
                ...state,
                [action.todoListId]: state[action.todoListId].map(t => t.id === action.taskId ? {
                    ...t,
                    entityStatus: action.entityStatus
                } : t)
            }
        case 'ADD-TODOLIST':
            return {...state, [action.item.id]: []}
        case 'REMOVE-TODOLIST':
            let copyState = {...state}
            delete copyState[action.id]
            return copyState
        default:
            return state
    }
}
//actions
export const setTasksAC = (tasks: Array<TaskType>, todolistId: string) => ({
    type: 'SET-TASKS',
    tasks,
    todolistId
}) as const
export const removeTaskAC = (taskId: string, todoListId: string) => ({type: 'REMOVE-TASK', taskId, todoListId}) as const
export const addTaskAC = (task: TaskType) => ({type: 'ADD-TASK', task}) as const
export const updateTaskAC = (taskId: string, model: UpdateDomainTaskModelType, todoListId: string) => ({
    type: 'UPDATE-TASK',
    model,
    todoListId,
    taskId
} as const)
export const changeTaskEntityStatusAC = (taskId: string, todoListId: string, entityStatus: RequestStatusType) => ({
    type: 'CHANGE-TASK-ENTITY-STATUS',
    taskId,
    todoListId,
    entityStatus
} as const)


//thunk
export const fetchTasksTC = (todolistId: string) => (dispatch: Dispatch<ActionsType>) => {
    dispatch(setAppStatusAC('loading'))
    todolistAPI.getTasks(todolistId)
        .then((res) => {
            const tasks = res.data.items
            const action = setTasksAC(tasks, todolistId)
            dispatch(action)
            dispatch(setAppStatusAC('succeeded'))
        })
}

export const removeTaskTC = (taskId: string, todolistId: string) =>
    async (dispatch: Dispatch<ActionsType>) => {
        try {
            dispatch(setAppStatusAC('loading'))
            dispatch(changeTaskEntityStatusAC(taskId, todolistId, 'loading'))
            await todolistAPI.deleteTask(taskId, todolistId,)
            dispatch(removeTaskAC(taskId, todolistId))
            dispatch(setAppStatusAC('succeeded'))
        } catch (error) {
            handleServerNetworkError(error, dispatch)
        }
    }

export const addTaskTC = (todolistId: string, title: string) => (dispatch: Dispatch<ActionsType>) => {
    dispatch(setAppStatusAC('loading'))
    todolistAPI.createTask(todolistId, title)
        .then((res) => {
            if (res.data.resultCode === 0) {
                const task = res.data.data.item
                dispatch(addTaskAC(task))
                dispatch(setAppStatusAC('succeeded'))
            } else {
                handleServerAppError(res.data, dispatch)
            }
        })
        .catch((error) => {
            handleServerNetworkError(error, dispatch)
        })
}

export const updateTaskTC = (taskId: string, domainModel: UpdateDomainTaskModelType, todolistId: string) =>
    (dispatch: Dispatch<ActionsType>, getState: () => AppRootStateType) => {
        const state = getState()
        const task = state.tasks[todolistId].find(t => t.id === taskId)
        if (!task) {
            //throw new Error("task not found in the state");
            console.warn('task not found in the state')
            return
        }
        const apiModel: UpdateTaskModelType = {
            deadline: task.deadline,
            description: task.description,
            priority: task.priority,
            startDate: task.startDate,
            title: task.title,
            status: task.status,
            ...domainModel
        }
        dispatch(setAppStatusAC('loading'))
        dispatch(changeTaskEntityStatusAC(taskId, todolistId, 'loading'))
        todolistAPI.updateTask(todolistId, taskId, apiModel)
            .then(res => {
                if (res.data.resultCode === 0) {
                    dispatch(updateTaskAC(taskId, domainModel, todolistId))
                    dispatch(setAppStatusAC('succeeded'))
                    dispatch(changeTaskEntityStatusAC(taskId, todolistId, 'idle'))
                } else {
                    handleServerAppError(res.data, dispatch)
                }
            })
            .catch((error) => {
                handleServerNetworkError(error, dispatch)
            })
    }


//types
export type TaskStateType = {
    [key: string]: Array<TaskType>,
}
export type UpdateDomainTaskModelType = {
    title?: string
    description?: string
    status?: TaskStatuses
    priority?: TodoTaskPriorities
    startDate?: string
    deadline?: string
}
export  type ActionsType =
    | AddTodolistActionType
    | RemoveTodolistActionType
    | SetTodolistsActionType
    | ReturnType<typeof setTasksAC>
    | ReturnType<typeof removeTaskAC>
    | ReturnType<typeof addTaskAC>
    | ReturnType<typeof updateTaskAC>
    | ReturnType<typeof setAppStatusAC>
    | ReturnType<typeof setAppErrorAC>
    | ReturnType<typeof changeTaskEntityStatusAC>


