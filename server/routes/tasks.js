import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listTasks, createTask, moveTasksToToday, completeTask, updateSubtask, resolveTaskOutcome, updateTask, deleteTask } from '../controllers/tasksController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listTasks);
router.post('/', createTask);
router.patch('/move-to-today', moveTasksToToday);
router.patch('/:id/complete', completeTask);
router.patch('/:id/subtasks/:subtaskId', updateSubtask);
router.patch('/:id/outcome', resolveTaskOutcome);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
export default router;
