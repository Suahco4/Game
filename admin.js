const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? 'http://localhost:3000/api' : 'https://game-a5vt.onrender.com/api';

let allStudents = []; // Store all students to enable client-side searching
let currentViewStudents = []; // The list of students currently being displayed (all or filtered)
let currentPage = 1;
const rowsPerPage = 10; // Number of students to show per page
let sortColumn = 'highScore'; // Default sort column
let sortDirection = 'desc'; // Default sort direction

document.addEventListener('DOMContentLoaded', () => {
    fetchAllStudents();
    document.getElementById('add-student-btn').addEventListener('click', addStudent);
    document.getElementById('generate-admin-id-btn').addEventListener('click', generateAndFillId);
    document.getElementById('save-changes-btn').addEventListener('click', saveStudentChanges);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('prev-page-btn').addEventListener('click', prevPage);
    document.getElementById('next-page-btn').addEventListener('click', nextPage);
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);

    // Add click listeners to sortable headers
    document.querySelectorAll('th.sortable').forEach(header => {
        header.addEventListener('click', () => {
            handleSort(header.dataset.sortBy);
        });
    });

    // Scroll button logic
    const scrollTopBtn = document.getElementById('scroll-to-top-btn');
    const scrollBottomBtn = document.getElementById('scroll-to-bottom-btn');

    // Show "Scroll to Top" button when user scrolls down
    window.onscroll = () => {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            scrollTopBtn.style.display = "block";
        } else {
            scrollTopBtn.style.display = "none";
        }
    };

    // Scroll to the top of the document
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Scroll to the bottom of the document
    scrollBottomBtn.addEventListener('click', () => {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    });
});


async function fetchAllStudents() {
    try {
        const response = await fetch(`${API_URL}/admin/students`);
        if (!response.ok) throw new Error('Failed to fetch student data.');

        allStudents = await response.json();
        currentViewStudents = allStudents; // Set the current view to all students
        sortAndDisplay(); // Sort by default and display
        currentPage = 1; // Reset to first page
        displayPage();
    } catch (error) {
        console.error('Error fetching students:', error);
        document.getElementById('student-table-body').innerHTML = `<tr><td colspan="8">Error loading data. Is the server running?</td></tr>`;
    }
}

function displayPage() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedStudents = currentViewStudents.slice(startIndex, endIndex);

    renderStudentTable(paginatedStudents);
    updatePaginationControls();
    updateSortIndicators();
}

function updatePaginationControls() {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const totalPages = Math.ceil(currentViewStudents.length / rowsPerPage);

    if (totalPages <= 1) {
        document.getElementById('pagination-controls').classList.add('hidden');
        return;
    }
    document.getElementById('pagination-controls').classList.remove('hidden');

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function prevPage() {
    if (currentPage > 1) { currentPage--; displayPage(); }
}

function nextPage() {
    if (currentPage < Math.ceil(currentViewStudents.length / rowsPerPage)) { currentPage++; displayPage(); }
}

function handleSort(column) {
    if (sortColumn === column) {
        // If the same column is clicked, reverse the direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // If a new column is clicked, set it as the sort column
        sortColumn = column;
        // Default to descending for scores/numbers, ascending for text
        sortDirection = ['sessions', 'badges', 'highScore', 'overallScore'].includes(column) ? 'desc' : 'asc';
    }
    sortAndDisplay();
}

function sortAndDisplay() {
    currentViewStudents.sort((a, b) => {
        // Handle special case for badges array length
        const valA = sortColumn === 'badges' ? a.badges.length : (a[sortColumn] || 0);
        const valB = sortColumn === 'badges' ? b.badges.length : (b[sortColumn] || 0);

        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }

        return sortDirection === 'desc' ? comparison * -1 : comparison;
    });

    currentPage = 1; // Reset to the first page after sorting
    displayPage();
}

function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sortBy === sortColumn) {
            header.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

function renderStudentTable(students) {
    const tableBody = document.getElementById('student-table-body');
    tableBody.innerHTML = ''; // Clear existing rows

    if (students.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8">No students found in the database.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Student ID" class="copyable-id" onclick="copyToClipboard('${student.studentId}', this)" title="Click to copy ID">${student.studentId}</td>
            <td data-label="Name">${student.name}</td>
            <td data-label="Class">${student.class}</td>
            <td data-label="Sessions">${student.sessions}</td>
            <td data-label="Badges">${student.badges.length}</td>
            <td data-label="High Score">${student.highScore}</td>
            <td data-label="Overall Score">${student.overallScore || 0}</td>
            <td data-label="Actions">
                <button class="btn btn-secondary" style="margin-right: 5px;" onclick="editStudent('${student.studentId}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteStudent('${student.studentId}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function copyToClipboard(text, element) {
    try {
        await navigator.clipboard.writeText(text);

        // Provide visual feedback to the user
        const originalText = element.textContent;
        element.textContent = 'Copied!';
        setTimeout(() => {
            element.textContent = originalText;
        }, 1500); // Revert back after 1.5 seconds

    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy ID. Your browser might not support this feature or is not in a secure context (HTTPS).');
    }
}

async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to delete student ${studentId}? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/students/${studentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete student.');
        fetchAllStudents(); // Refresh the table on success
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Could not delete student. The server may be down.');
    }
}

async function addStudent() {
    const studentId = document.getElementById('new-student-id').value.trim();
    const name = document.getElementById('new-student-name').value.trim();
    const studentClass = document.getElementById('new-student-class').value.trim();

    if (!studentId || !name || !studentClass) {
        alert('Please fill out all fields to add a student.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, name, class: studentClass })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Server responded with an error.');
        }
        const newStudent = await response.json();
        allStudents.push(newStudent); // Add to local array
        // Clear form and refresh table
        resetForm(true); // Pass true to re-sort and display
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student. The Student ID might already exist.');
    }
}

function generateAndFillId() {
    // Generate 7 random digits, padded with leading zeros if necessary
    const randomPart = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
    const newId = `044${randomPart}`;
    // Fill the input field with the new ID
    document.getElementById('new-student-id').value = newId;
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!searchTerm) {
        currentViewStudents = [...allStudents]; // Use a copy to avoid modifying the original
    } else {
        currentViewStudents = allStudents.filter(student =>
            student.name.toLowerCase().includes(searchTerm) ||
            student.studentId.toLowerCase().includes(searchTerm)
        );
    }

    sortAndDisplay(); // Re-sort and display the filtered results
}

function editStudent(studentId) {
    const student = allStudents.find(s => s.studentId === studentId);
    if (!student) return;

    // Populate the form
    document.getElementById('new-student-id').value = student.studentId;
    document.getElementById('new-student-name').value = student.name;
    document.getElementById('new-student-class').value = student.class;

    // Change form to "Edit Mode"
    document.getElementById('add-student-form').querySelector('h3').textContent = 'Edit Student';
    document.getElementById('new-student-id').readOnly = true; // ID should not be changed
    document.getElementById('generate-admin-id-btn').classList.add('hidden');
    document.getElementById('add-student-btn').classList.add('hidden');
    document.getElementById('save-changes-btn').classList.remove('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    // Scroll to the form
    document.getElementById('add-student-form').scrollIntoView({ behavior: 'smooth' });
}

async function saveStudentChanges() {
    const studentId = document.getElementById('new-student-id').value;
    const name = document.getElementById('new-student-name').value.trim();
    const studentClass = document.getElementById('new-student-class').value.trim();

    if (!name || !studentClass) {
        alert('Name and Class cannot be empty.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, class: studentClass })
        });

        if (!response.ok) throw new Error('Failed to save changes.');

        resetForm();
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Could not save changes. Please try again.');
    }
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Define table columns
    const head = [['Student ID', 'Name', 'Class', 'Sessions', 'Badges', 'High Score', 'Overall Score']];
    
    // Map all student data to the format required by jsPDF-AutoTable
    const body = allStudents.map(student => [
        student.studentId,
        student.name,
        student.class,
        student.sessions,
        student.badges.length,
        student.highScore,
        student.overallScore || 0
    ]);

    // Add a title to the document
    doc.text("Student Data Report", 14, 15);

    // Generate the table
    doc.autoTable({
        head: head,
        body: body,
        startY: 20, // Start table after the title
    });

    // Save the PDF
    doc.save('student-data-report.pdf');
}

function cancelEdit() {
    resetForm(false);
}

function resetForm(shouldSortAndDisplay = false) {
    document.getElementById('add-student-form').querySelector('h3').textContent = 'Add New Student';
    document.getElementById('new-student-id').value = '';
    document.getElementById('new-student-id').readOnly = false;
    document.getElementById('new-student-name').value = '';
    document.getElementById('new-student-class').value = '';
    document.getElementById('generate-admin-id-btn').classList.remove('hidden');
    document.getElementById('add-student-btn').classList.remove('hidden');
    document.getElementById('save-changes-btn').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    if (shouldSortAndDisplay) {
        sortAndDisplay();
    } else {
        fetchAllStudents(); // Refresh the table
    }
}